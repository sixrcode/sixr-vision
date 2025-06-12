
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import type { WebGLSceneAssets } from "@/types";
import { useSettingsStore } from "@/store/settingsStore"; // MODIFIED: Import Zustand store
import { useAudioDataStore } from "@/store/audioDataStore"; // MODIFIED: Import Zustand store
// useScene (context hook) is no longer needed for scene definitions
import { SCENES as allScenesConstant } from '@/lib/constants'; // MODIFIED: Import SCENES directly

import { BrandingOverlay } from "./BrandingOverlay";
import { WebcamFeed } from "./WebcamFeed";

/**
 * VisualizerView
 * ------------------------------------------------------------------
 * • Pure WebGL render‑path (legacy 2‑D canvas removed).
 * • Handles scene init / cleanup, resize, FPS monitoring, webcam feed,
 *   optional AI overlay (as WebGL texture) and branding overlay.
 */

export function VisualizerView() {
  /* ─────────────────────────── Refs & State ────────────────────────── */
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // Note: overlayCanvasRef is not currently used for drawing

  // MODIFIED: Use Zustand stores
  const settings = useSettingsStore(state => state); // Get all settings
  const audioData = useAudioDataStore(state => state); // Get all audio data
  const scenes = allScenesConstant; // Scenes are now from the constant

  const animationIdRef          = useRef<number | null>(null);
  const webGLRendererRef        = useRef<THREE.WebGLRenderer | null>(null);
  const currentAssetsRef        = useRef<WebGLSceneAssets | null>(null);
  const previousAssetsCleanup   = useRef<WebGLSceneAssets | null>(null);
  const lastSceneIdRef          = useRef<string | undefined>(settings.currentSceneId);

  /* FPS */
  const lastFrameTimeRef = useRef(performance.now());
  const frameCounterRef  = useRef(0);
  const [fps, setFps]    = useState(0);
  const fpsWarnDelta     = 10;
  const lastFpsLogged    = useRef(0);

  /* AI overlay */
  const [aiTex, setAiTex]     = useState<THREE.CanvasTexture | null>(null);
  const aiTexUnmountRef       = useRef<THREE.Texture | null>(null);

  /* Errors */
  const [fatalError, setFatalError] = useState<string | null>(null);

  /* Webcam */
  const [webcamEl, setWebcamEl] = useState<HTMLVideoElement | null>(null);

  /* ─────────────────────── Scene (Re)initialisation ─────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newScene = scenes.find(s => s.id === settings.currentSceneId) || null;
    const prevScene = scenes.find(s => s.id === lastSceneIdRef.current) || null;

    /** cleanup previous scene assets */
    if (
      prevScene &&
      prevScene.id !== newScene?.id &&
      prevScene.cleanupWebGL &&
      previousAssetsCleanup.current
    ) {
      prevScene.cleanupWebGL(previousAssetsCleanup.current);
      previousAssetsCleanup.current = null;
    }

    /** init new scene */
    if (newScene && newScene.initWebGL) {
      /* renderer lifecycle */
      if (!webGLRendererRef.current || webGLRendererRef.current.domElement !== canvas) {
        webGLRendererRef.current?.dispose();
        try {
          webGLRendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
          webGLRendererRef.current.setPixelRatio(window.devicePixelRatio);
        } catch (err) {
          setFatalError(err instanceof Error ? err.message : String(err));
          return;
        }
      }

      webGLRendererRef.current.setSize(canvas.width, canvas.height);

      try {
        // Pass all settings to initWebGL
        const assets = newScene.initWebGL(canvas, settings, webcamEl);
        currentAssetsRef.current       = assets;
        previousAssetsCleanup.current  = assets;
        setFatalError(null);
      } catch (err) {
        setFatalError(err instanceof Error ? err.message : String(err));
        currentAssetsRef.current       = null;
        previousAssetsCleanup.current  = null;
      }
    } else {
      currentAssetsRef.current = null;
    }

    lastSceneIdRef.current = settings.currentSceneId;
  }, [settings.currentSceneId, scenes, settings, webcamEl]); // settings object is now a dependency

  /* ───────────────────────────── AI Overlay ─────────────────────────── */
  useEffect(() => {
    if (settings.enableAiOverlay && settings.aiGeneratedOverlayUri) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const tex = new THREE.CanvasTexture(img);
        tex.needsUpdate = true;
        setAiTex(prev => {
          prev?.dispose();
          return tex;
        });
      };
      img.onerror = () => setAiTex(prev => { prev?.dispose(); return null; });
      img.src = settings.aiGeneratedOverlayUri;
    } else {
      setAiTex(prev => { prev?.dispose(); return null; });
    }
  }, [settings.enableAiOverlay, settings.aiGeneratedOverlayUri]);

  /* keep ref for unmount */
  useEffect(() => { aiTexUnmountRef.current = aiTex; }, [aiTex]);
  useEffect(() => () => { aiTexUnmountRef.current?.dispose(); }, []);

  /* ───────────────────────────── FPS Monitor ────────────────────────── */
  const tickFps = useCallback(() => {
    const now = performance.now();
    const dt  = now - lastFrameTimeRef.current;
    frameCounterRef.current += 1;
    if (dt >= 1000) {
      setFps(frameCounterRef.current);
      frameCounterRef.current = 0;
      lastFrameTimeRef.current = now;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!settings.panicMode && fps > 0) {
        if (lastFpsLogged.current > 0 && lastFpsLogged.current - fps > fpsWarnDelta) {
          console.warn(`[Performance] FPS drop: ${lastFpsLogged.current} → ${fps}`);
        }
        lastFpsLogged.current = fps;
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [fps, settings.panicMode]);

  /* ───────────────────────────── Draw Loop ──────────────────────────── */
  const draw = useCallback(() => {
    animationIdRef.current = requestAnimationFrame(draw);
    tickFps();

    const canvas = canvasRef.current;
    if (!canvas || !webGLRendererRef.current) return;

    const sceneDef = scenes.find(s => s.id === settings.currentSceneId);
    if (!sceneDef || !sceneDef.drawWebGL) return;

    try {
      if (settings.panicMode) {
        webGLRendererRef.current.setClearColor(0x000000, 1);
        webGLRendererRef.current.clear();
        return;
      }

      const { scene: currentThreeScene, camera: currentThreeCamera } = currentAssetsRef.current || {}; // Renamed to avoid conflict
      if (currentThreeScene && currentThreeCamera) {
        sceneDef.drawWebGL({
          renderer:    webGLRendererRef.current,
          scene: currentThreeScene, // Use renamed variable
          camera: currentThreeCamera, // Use renamed variable
          audioData,
          settings, // Pass all settings
          webGLAssets: currentAssetsRef.current!, // Assert not null as we checked scene and camera
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          webcamElement: webcamEl,
        });

        webGLRendererRef.current.render(currentThreeScene, currentThreeCamera);

        /* AI overlay */
        if (settings.enableAiOverlay && aiTex) {
          const w = canvas.width;
          const h = canvas.height;
          const cam   = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, 0, 1);
          const scene2 = new THREE.Scene();
          const geom   = new THREE.PlaneGeometry(w, h);
          const mat    = new THREE.MeshBasicMaterial({ map: aiTex, transparent: true, opacity: settings.aiOverlayOpacity });
          scene2.add(new THREE.Mesh(geom, mat));
          const auto = webGLRendererRef.current.autoClear;
          webGLRendererRef.current.autoClear = false;
          webGLRendererRef.current.render(scene2, cam);
          webGLRendererRef.current.autoClear = auto;
        }

        setFatalError(null);
      }
    } catch (err) {
      console.error("Visualizer draw error", err);
      setFatalError(err instanceof Error ? err.message : String(err));
    }
  }, [scenes, settings, audioData, webcamEl, aiTex, tickFps]); // settings and audioData are now direct dependencies

  useEffect(() => {
    animationIdRef.current = requestAnimationFrame(draw);
    return () => { if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current); };
  }, [draw]);

  /* ─────────────────────────── Canvas Resize ────────────────────────── */
  useEffect(() => {
    const cMain = canvasRef.current;
    const parent = cMain?.parentElement;
    if (!cMain || !parent) return;

    const handleResize = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (cMain.width !== w || cMain.height !== h) {
        cMain.width = w; cMain.height = h;
        if (webGLRendererRef.current) webGLRendererRef.current.setSize(w, h);
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
      <WebcamFeed onWebcamElement={setWebcamEl} />

      {fatalError && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center p-4 text-red-500 text-center whitespace-pre-wrap text-sm">
          {fatalError}
        </div>
      )}
    </div>
  );
}
