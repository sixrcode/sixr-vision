/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import type { WebGLSceneAssets } from '@/types';

import { useSettings }   from '@/providers/SettingsProvider';
import { useAudioData }  from '@/providers/AudioDataProvider';
import { useScene }      from '@/providers/SceneProvider';

import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed }      from './WebcamFeed';

/**
 * VisualizerView
 * ------------------------------------------------------------------
 * • Single WebGL render-path (legacy 2-D canvas renderer removed).
 * • Handles scene init / cleanup, resize, FPS monitoring, webcam feed,
 *   optional AI overlay (as WebGL texture) and branding overlay.
 */

export function VisualizerView() {
  /* ─────────────────────────── Refs & State ────────────────────────── */
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const { settings } = useSettings();
  const { audioData } = useAudioData();
  const { scenes }    = useScene();

  const animationFrameIdRef = useRef<number | null>(null);
  const lastSceneIdRef      = useRef<string | undefined>(settings.currentSceneId);

  /* Webcam */
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);

  /* Error banner */
  const [lastError, setLastError] = useState<string | null>(null);

  /* AI overlay */
  const aiOverlayImageRef   = useRef<HTMLImageElement | null>(null);
  const [aiOverlayTexture, setAiOverlayTexture] = useState<THREE.CanvasTexture | null>(null);
  const aiOverlayTexRef     = useRef<THREE.CanvasTexture | null>(null); // for unmount dispose

  /* WebGL renderer & per-scene assets */
  const webGLRendererRef              = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneAssetsRef         = useRef<WebGLSceneAssets | null>(null);
  const previousSceneAssetsCleanupRef = useRef<WebGLSceneAssets | null>(null);

  /* FPS monitor */
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef    = useRef(0);
  const [fps, setFps]    = useState(0);
  const lastLoggedFpsRef = useRef<number>(0);
  const fpsDropThreshold = 10;

  /* ─────────────────────── Scene (Re)initialisation ─────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newSceneDef  = scenes.find(s => s.id === settings.currentSceneId) || null;
    const prevSceneDef = scenes.find(s => s.id === lastSceneIdRef.current)   || null;

    /* Clean up previous scene’s WebGL assets */
    if (
      prevSceneDef &&
      prevSceneDef.id !== newSceneDef?.id &&
      prevSceneDef.cleanupWebGL &&
      previousSceneAssetsCleanupRef.current
    ) {
      prevSceneDef.cleanupWebGL(previousSceneAssetsCleanupRef.current);
      previousSceneAssetsCleanupRef.current = null;
    }

    /* Initialise new scene (if it has WebGL hooks) */
    if (newSceneDef && newSceneDef.initWebGL) {
      /* create renderer once (or recreate if canvas element changed) */
      if (!webGLRendererRef.current || webGLRendererRef.current.domElement !== canvas) {
        if (webGLRendererRef.current) webGLRendererRef.current.dispose();
        try {
          webGLRendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
          webGLRendererRef.current.setPixelRatio(window.devicePixelRatio);
        } catch (err) {
          setLastError(err instanceof Error ? err.message : String(err));
          return;
        }
      }

      webGLRendererRef.current.setSize(canvas.width, canvas.height);

      try {
        const assets = newSceneDef.initWebGL(canvas, settings, webcamElement);
        currentSceneAssetsRef.current         = assets;
        previousSceneAssetsCleanupRef.current = assets;
        setLastError(null);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : String(err));
        currentSceneAssetsRef.current         = null;
        previousSceneAssetsCleanupRef.current = null;
      }
    } else {
      currentSceneAssetsRef.current = null; // scene might be purely 2-D (none left)
    }

    lastSceneIdRef.current = settings.currentSceneId;

    return () => {
      /* cleanup when effect re-runs or unmounts */
      const sceneToClean = scenes.find(s => s.id === lastSceneIdRef.current);
      if (
        sceneToClean &&
        sceneToClean.cleanupWebGL &&
        previousSceneAssetsCleanupRef.current
      ) {
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

  /* keep ref for unmount */
  useEffect(() => { aiOverlayTexRef.current = aiOverlayTexture; }, [aiOverlayTexture]);
  useEffect(() => () => { aiOverlayTexRef.current?.dispose(); }, []);

  /* ───────────────────────────── FPS Monitor ────────────────────────── */
  const updateFps = useCallback(() => {
    const now = performance.now();
    const dt  = now - lastFrameTimeRef.current;
    frameCountRef.current += 1;
    if (dt >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current   = 0;
      lastFrameTimeRef.current = now;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!settings.panicMode && fps > 0) {
        if (lastLoggedFpsRef.current > 0 && lastLoggedFpsRef.current - fps > fpsDropThreshold) {
          console.warn(`[Performance] FPS drop: ${lastLoggedFpsRef.current} → ${fps}`);
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

    try {
      if (settings.panicMode) {
        webGLRendererRef.current?.setClearColor(0x000000, 1);
        webGLRendererRef.current?.clear();
        return;
      }

      if (
        webGLRendererRef.current &&
        currentSceneAssetsRef.current?.scene &&
        currentSceneAssetsRef.current?.camera
      ) {
        /* scene update */
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

        /* render base scene */
        webGLRendererRef.current.render(
          currentSceneAssetsRef.current.scene,
          currentSceneAssetsRef.current.camera,
        );

        /* AI overlay pass */
        if (settings.enableAiOverlay && aiOverlayTexture) {
          const w = canvas.width;
          const h = canvas.height;

          const cam   = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0, 1);
          const scene = new THREE.Scene();
          const geom  = new THREE.PlaneGeometry(w, h);
          const mat   = new THREE.MeshBasicMaterial({
            map:         aiOverlayTexture,
            transparent: true,
            opacity:     settings.aiOverlayOpacity,
            blending:    THREE.CustomBlending,
          });

          switch (settings.aiOverlayBlendMode) {
            case 'multiply':
              mat.blendSrc = THREE.DstColorFactor;   mat.blendDst = THREE.ZeroFactor; break;
            case 'screen':
              mat.blendSrc = THREE.OneFactor;        mat.blendDst = THREE.OneMinusSrcColorFactor; break;
            case 'add':
              mat.blendSrc = THREE.SrcAlphaFactor;   mat.blendDst = THREE.OneFactor; break;
            default: // normal
              mat.blendSrc = THREE.SrcAlphaFactor;   mat.blendDst = THREE.OneMinusSrcAlphaFactor;
          }

          scene.add(new THREE.Mesh(geom, mat));

          const autoClear = webGLRendererRef.current.autoClear;
          webGLRendererRef.current.autoClear = false;
          webGLRendererRef.current.render(scene, cam);
          webGLRendererRef.current.autoClear = autoClear;
        }

        setLastError(null);
      }
    } catch (err) {
      console.error('VisualizerView: drawLoop error', err);
      setLastError(err instanceof Error ? err.message : String(err));
    }
  }, [
    scenes,
    settings,
    audioData,
    webcamElement,
    aiOverlayTexture,
    updateFps,
  ]);

  /* mount / unmount drawLoop */
  useEffect(() => {
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [drawLoop]);

  /* ─────────────────────────── Canvas Resize ────────────────────────── */
  useEffect(() => {
    const cMain    = canvasRef.current;
    const cOverlay = overlayCanvasRef.current;
    if (!cMain || !cOverlay) return;

    const parent = cMain.parentElement;
    if (!parent) return;

    const handleResize = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      if (cMain.width !== w || cMain.height !== h) {
        cMain.width = w; cMain.height = h;
      }
      if (cOverlay.width !== w || cOverlay.height !== h) {
        cOverlay.width = w; cOverlay.height = h;
      }

      if (webGLRendererRef.current) {
        webGLRendererRef.current.setSize(w, h);
        const cam = currentSceneAssetsRef.current?.camera;
        if (cam instanceof THREE.PerspectiveCamera) {
          cam.aspect = w / h;
        } else if (cam instanceof THREE.OrthographicCamera) {
          cam.left = -w / 2; cam.right = w / 2; cam.top = h / 2; cam.bottom = -h / 2;
        }
        cam?.updateProjectionMatrix();
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);
    handleResize();
    return () => ro.disconnect();
  }, []);

  /* ───────────────────────────── JSX ──────────────────────────────── */
  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef}        className="absolute inset-0 w-full h-full z-0" />
      <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none" />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />

      {/* fatal-error banner (dev only) */}
      {lastError && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center p-4 text-red-500 text-center whitespace-pre-wrap text-sm">
          {lastError}
        </div>
      )}
    </div>
  );
}
