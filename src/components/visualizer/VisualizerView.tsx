
"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SceneDefinition, Settings, AudioData, WebGLSceneAssets } from '@/types';
import { useSettings } from '@/providers/SettingsProvider';
import { useAudioData } from '@/providers/AudioDataProvider';
import { useScene } from '@/providers/SceneProvider';
import { BrandingOverlay } from './BrandingOverlay';
import { WebcamFeed } from './WebcamFeed';
import * as THREE from 'three';
// SBNF_BODY_FONT_FAMILY and SBNF_TITLE_FONT_FAMILY likely unused now, will confirm later.

/**
 * @fileOverview The main component responsible for rendering the visualizer canvas.
 * It manages the animation loop, scene transitions, webcam feed integration,
 * and overlaying branding elements. It supports both 2D Canvas and WebGL scenes.
 */

export function VisualizerView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();
  const { audioData } = useAudioData();
  const { scenes } = useScene(); // currentScene is derived, scenes is the full list
  const animationFrameIdRef = useRef<number | null>(null);
  const [webcamElement, setWebcamElement] = useState<HTMLVideoElement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const aiOverlayImageRef = useRef<HTMLImageElement | null>(null);
  const [aiOverlayTexture, setAiOverlayTexture] = useState<THREE.CanvasTexture | null>(null);
  const aiOverlayTextureRef = useRef<THREE.CanvasTexture | null>(null); // For cleanup

  // WebGL specific refs
  const webGLRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentSceneWebGLAssetsRef = useRef<any>(null); // Holds assets from currentScene.initWebGL
  const previousSceneWebGLAssetsRef = useRef<any>(null); // For cleaning up previous WebGL scene assets

  const lastSceneIdRef = useRef<string | undefined>(settings.currentSceneId);

  // FPS Counter states
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const lastLoggedFpsRef = useRef<number>(0);
  const fpsDropThreshold = 10;
  const fpsLogIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scene initialization and cleanup effect (now WebGL only)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newSceneDefinition = scenes.find(s => s.id === settings.currentSceneId) || null;
    const prevSceneObject = scenes.find(s => s.id === lastSceneIdRef.current) || null;

    // --- Start of Simplified WebGL Initialization Logic ---
    // Always assume WebGL. No more renderer type checks or canvas re-keying.

    // Clean up previous WebGL scene assets if the scene is changing 
    // and the previous scene was a WebGL scene with a cleanup function.
    if (prevSceneObject && prevSceneObject.id !== newSceneDefinition?.id && 
        prevSceneObject.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
      console.log(`VisualizerView: Cleaning up WebGL assets for previous scene: ${prevSceneObject.id}`);
      prevSceneObject.cleanupWebGL(previousSceneWebGLAssetsRef.current);
      previousSceneWebGLAssetsRef.current = null; // Clear the ref after cleanup
    }

    if (newSceneDefinition && newSceneDefinition.initWebGL) {
      console.log(`VisualizerView: Initializing WebGL for scene: ${newSceneDefinition.id}`);
      
      if (!webGLRendererRef.current) {
        console.log("VisualizerView: Creating new WebGLRenderer instance.");
        try {
          webGLRendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
          webGLRendererRef.current.setPixelRatio(window.devicePixelRatio); // Set pixel ratio once
        } catch (e) {
            console.error("VisualizerView: Failed to create WebGLRenderer:", e);
            setLastError(e instanceof Error ? e.message : String(e));
            currentSceneWebGLAssetsRef.current = null; // Ensure assets are cleared
            previousSceneWebGLAssetsRef.current = null;
            lastSceneIdRef.current = settings.currentSceneId;
            return; // Stop if renderer creation fails
        }
      }
      
      // Always ensure renderer is configured for the current canvas dimensions
      // This should ideally be handled by the resize observer, but good to have here too.
      if (webGLRendererRef.current.domElement.width !== canvas.width || webGLRendererRef.current.domElement.height !== canvas.height) {
        webGLRendererRef.current.setSize(canvas.width, canvas.height);
      }

      try {
        // Initialize the new scene's assets
        const initializedAssets = newSceneDefinition.initWebGL(canvas, settings, webcamElement);
        currentSceneWebGLAssetsRef.current = initializedAssets;
        previousSceneWebGLAssetsRef.current = initializedAssets; // Keep track for next cleanup
        if (lastError) setLastError(null); // Clear any previous init error
      } catch (e) {
        console.error("VisualizerView: Error during WebGL initialization for scene:", newSceneDefinition.id, e);
        setLastError(e instanceof Error ? e.message : String(e));
        // Don't dispose the main renderer here, just clear assets. 
        // An error in one scene's init shouldn't kill the main renderer.
        currentSceneWebGLAssetsRef.current = null;
        previousSceneWebGLAssetsRef.current = null; // No assets to clean for this failed scene
      }
    } else {
      // No new scene definition or it's not a WebGL scene (which shouldn't happen anymore)
      // or it's missing initWebGL.
      // If there was a previous scene, its assets should have been cleaned above.
      // If no new scene, clear current assets.
      currentSceneWebGLAssetsRef.current = null; 
      if (newSceneDefinition) {
        console.warn(`VisualizerView: Scene ${newSceneDefinition.id} is missing initWebGL or is not a WebGL scene.`);
      } else if (settings.currentSceneId) {
        console.warn(`VisualizerView: Scene with ID ${settings.currentSceneId} not found.`);
      }
    }
    // --- End of Simplified WebGL Initialization Logic ---
    
    lastSceneIdRef.current = settings.currentSceneId;

    // Cleanup function for this effect
    return () => {
      // This cleanup runs if settings.currentSceneId, scenes, webcamElement, or settings change.
      // It should clean up the assets of the scene that was active *before* the change.
      const sceneToClean = scenes.find(s => s.id === lastSceneIdRef.current); 
      if (sceneToClean && sceneToClean.cleanupWebGL && previousSceneWebGLAssetsRef.current) {
        console.log(`VisualizerView Effect Cleanup: Cleaning up WebGL assets for scene: ${sceneToClean.id} due to effect re-run.`);
        sceneToClean.cleanupWebGL(previousSceneWebGLAssetsRef.current);
        previousSceneWebGLAssetsRef.current = null;
      }
    };
  }, [settings.currentSceneId, scenes, webcamElement, settings, lastError]); // Removed canvasKey, added lastError


  useEffect(() => {
    // Update the ref whenever the state changes, for reliable cleanup
    aiOverlayTextureRef.current = aiOverlayTexture;
  }, [aiOverlayTexture]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      // This executes when the component unmounts
      if (aiOverlayTextureRef.current) {
        console.log("VisualizerView: Disposing AI overlay texture on component unmount.");
        aiOverlayTextureRef.current.dispose();
        aiOverlayTextureRef.current = null; // Clear the ref
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  useEffect(() => {
    if (settings.enableAiOverlay && settings.aiGeneratedOverlayUri) {
      const img = new Image();
      img.crossOrigin = "anonymous"; // Recommended for images from other origins
      img.onload = () => {
        aiOverlayImageRef.current = img; // Keep the HTMLImageElement ref updated
        
        const newTexture = new THREE.CanvasTexture(img);
        newTexture.needsUpdate = true;
        
        // Dispose the previous texture before setting the new one
        setAiOverlayTexture(prevTexture => {
          if (prevTexture && prevTexture !== newTexture) { // Avoid self-disposal if somehow same instance
            prevTexture.dispose();
          }
          return newTexture;
        });
      };
      img.onerror = () => {
        console.error("VisualizerView: Failed to load AI overlay image.");
        aiOverlayImageRef.current = null;
        setAiOverlayTexture(prevTexture => {
          if (prevTexture) {
            prevTexture.dispose();
          }
          return null;
        });
      };
      img.src = settings.aiGeneratedOverlayUri;
    } else {
      aiOverlayImageRef.current = null;
      setAiOverlayTexture(prevTexture => {
        if (prevTexture) {
          prevTexture.dispose();
        }
        return null;
      });
    }
    // The cleanup function for *this specific effect* is intentionally minimal here.
    // The logic within the effect already handles disposing and nullifying the texture
    // when settings.enableAiOverlay or settings.aiGeneratedOverlayUri change.
    // The component-level unmount effect handles the final cleanup.
    return () => {}; 
  }, [settings.enableAiOverlay, settings.aiGeneratedOverlayUri, setAiOverlayTexture]); 

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
      if (!settings.panicMode && fps > 0) {
        // console.log(`[Performance Monitor] Current FPS: ${fps}`); // Kept for debugging if needed
        if (lastLoggedFpsRef.current > 0 && (lastLoggedFpsRef.current - fps > fpsDropThreshold)) {
           console.warn(`[Performance Monitor] Significant FPS drop detected! From ~${lastLoggedFpsRef.current} to ${fps}`);
        }
        lastLoggedFpsRef.current = fps;
      }
    }, 5000); // Log every 5 seconds
    return () => {
      if (fpsLogIntervalRef.current) clearInterval(fpsLogIntervalRef.current);
    };
  }, [fps, settings.panicMode]);

  // All 2D drawing functions (get2DContext, drawPrimarySceneContent, drawAiGeneratedOverlay2D, drawDebugInfo, drawErrorState) are removed.

  const drawLoop = useCallback(() => {
    animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    updateFps();

    const activeSceneDefinition = scenes.find(s => s.id === settings.currentSceneId);
    // intendedRendererType is no longer needed, assume 'webgl' or error/panic.

    try {
      if (lastError && webGLRendererRef.current) {
        // If there's a persistent error, clear to black and log it.
        // This might occur if initWebGL fails repeatedly.
        console.error("VisualizerView Error in drawLoop (persisting):", lastError);
        const bgColorString = getComputedStyle(canvas).getPropertyValue('--background').trim() || '#000000';
        webGLRendererRef.current.setClearColor(new THREE.Color(bgColorString).getHex(), 1);
        webGLRendererRef.current.clear();
        // Do not setLastError(null) here, as the error condition might still exist.
        // The scene init useEffect is responsible for clearing lastError upon successful init.
      } else if (settings.panicMode) {
        if (webGLRendererRef.current) {
          webGLRendererRef.current.setClearColor(0x000000, 1);
          webGLRendererRef.current.clear();
        }
        // No need to check lastError here, panic mode overrides.
        // if (lastError) setLastError(null); // Let init effect handle this if panic mode is exited.
      } else if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current && currentSceneWebGLAssetsRef.current.scene && currentSceneWebGLAssetsRef.current.camera && activeSceneDefinition?.drawWebGL) {
        // Normal WebGL rendering path
        activeSceneDefinition.drawWebGL({
            renderer: webGLRendererRef.current,
            scene: currentSceneWebGLAssetsRef.current.scene,
            camera: currentSceneWebGLAssetsRef.current.camera,
            audioData,
            settings,
            webGLAssets: currentSceneWebGLAssetsRef.current,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            webcamElement,
          });
          webGLRendererRef.current.render(currentSceneWebGLAssetsRef.current.scene, currentSceneWebGLAssetsRef.current.camera);

          // AI Overlay Rendering for WebGL
          // Use aiOverlayTexture from state here
          if (settings.enableAiOverlay && aiOverlayTexture && webGLRendererRef.current && canvasRef.current) {
            const overlayCanvas = canvasRef.current; 
            const overlayCamera = new THREE.OrthographicCamera(-overlayCanvas.width / 2, overlayCanvas.width / 2, overlayCanvas.height / 2, -overlayCanvas.height / 2, 0, 1);
            const overlayScene = new THREE.Scene();
            const overlayGeometry = new THREE.PlaneGeometry(overlayCanvas.width, overlayCanvas.height);
            
            // aiOverlayTexture (from state) is used directly in material.map
            // The local const aiOverlayTexture is removed.
            // needsUpdate is handled in useEffect when texture is created/changed.

            const overlayMaterial = new THREE.MeshBasicMaterial();
            overlayMaterial.map = aiOverlayTexture; // Use texture from state
            overlayMaterial.transparent = true;
            overlayMaterial.opacity = settings.aiOverlayOpacity;
            
            overlayMaterial.blending = THREE.CustomBlending;
            switch (settings.aiOverlayBlendMode) {
              case 'source-over': // Normal
                overlayMaterial.blendSrc = THREE.SrcAlphaFactor;
                overlayMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
                overlayMaterial.blendEquation = THREE.AddEquation;
                break;
              case 'multiply':
                overlayMaterial.blendSrc = THREE.DstColorFactor;
                overlayMaterial.blendDst = THREE.ZeroFactor; 
                overlayMaterial.blendEquation = THREE.AddEquation;
                break;
              case 'screen':
                overlayMaterial.blendSrc = THREE.OneFactor; 
                overlayMaterial.blendDst = THREE.OneMinusSrcColorFactor;
                overlayMaterial.blendEquation = THREE.AddEquation;
                break;
              case 'add': // Lighter
                overlayMaterial.blendSrc = THREE.SrcAlphaFactor;
                overlayMaterial.blendDst = THREE.OneFactor;
                overlayMaterial.blendEquation = THREE.AddEquation;
                break;
              case 'overlay':
              case 'soft-light':
              case 'hard-light':
              case 'difference':
              case 'exclusion':
              case 'hue':
              case 'saturation':
              case 'color':
              case 'luminosity':
              default: // Default to normal blending
                overlayMaterial.blendSrc = THREE.SrcAlphaFactor;
                overlayMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
                overlayMaterial.blendEquation = THREE.AddEquation;
                break;
            }

            const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
            overlayScene.add(overlayMesh);

            // Cache current autoClear states
            const autoClearCache = webGLRendererRef.current.autoClear;
            const autoClearColorCache = webGLRendererRef.current.autoClearColor;
            const autoClearDepthCache = webGLRendererRef.current.autoClearDepth;
            const autoClearStencilCache = webGLRendererRef.current.autoClearStencil;

            webGLRendererRef.current.autoClear = false; 
            // No need to set autoClearColor, autoClearDepth, autoClearStencil individually if autoClear is false

            webGLRendererRef.current.render(overlayScene, overlayCamera);
            
            // Restore autoClear states
            webGLRendererRef.current.autoClear = autoClearCache;
            webGLRendererRef.current.autoClearColor = autoClearColorCache;
            webGLRendererRef.current.autoClearDepth = autoClearDepthCache;
            webGLRendererRef.current.autoClearStencil = autoClearStencilCache;
          }

          if (lastError) setLastError(null);
        } else if (webGLRendererRef.current) { 
            // WebGL scene is intended, but resources not fully ready, clear with its own renderer.
             const bgColorString = getComputedStyle(canvas).getPropertyValue('--background').trim() || '#000000';
             webGLRendererRef.current.setClearColor(new THREE.Color(bgColorString).getHex(), 1);
             webGLRendererRef.current.clear();
        } else if (!webGLRendererRef.current && !lastError) {
          // Renderer not created, and no specific error reported yet from init.
          // This might happen if canvas is not ready during first init attempt.
          // The init useEffect should eventually set an error or create the renderer.
          console.warn("VisualizerView: WebGL renderer not available in drawLoop, and no specific error set. Canvas might not be ready or init pending.");
        }
        // If lastError is set, the top condition `if (lastError && webGLRendererRef.current)` handles it.
        // If webGLRendererRef.current is null and lastError IS set, it means renderer creation failed, handled by init.
      }
    } catch (error) {
      // This catch block is for errors during the drawWebGL call or overlay rendering itself.
      console.error("VisualizerView: Runtime error in draw loop (WebGL path):", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== lastError) setLastError(errorMessage);
      // No 2D error drawing. The `if (lastError)` block at the top will handle clearing.
    }
    // prevRendererTypeRef.current = intendedRendererType; // This line is removed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
      settings, audioData, scenes, lastError, fps, 
      updateFps, 
      webcamElement,
      aiOverlayTexture 
      // Removed get2DContext, drawPrimarySceneContent, drawAiGeneratedOverlay2D, drawDebugInfo, drawErrorState from deps
      // Removed isTransitioning2D from deps
  ]);

  // Canvas resize effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        const resizeObserver = new ResizeObserver(() => {
          const newWidth = parent.clientWidth;
          const newHeight = parent.clientHeight;
          if(canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
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
          }
        });
        resizeObserver.observe(parent);
        // Initial size set
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        if (webGLRendererRef.current && currentSceneWebGLAssetsRef.current?.camera) { 
            webGLRendererRef.current.setSize(canvas.width, canvas.height);
             const camera = currentSceneWebGLAssetsRef.current.camera;
            if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = canvas.width / canvas.height;
            } else if (camera instanceof THREE.OrthographicCamera) {
                camera.left = -canvas.width / 2;
                camera.right = canvas.width / 2;
                camera.top = canvas.height / 2;
                camera.bottom = -canvas.height / 2;
            }
            camera.updateProjectionMatrix();
        }
        return () => resizeObserver.disconnect();
      }
    }
  }, []); // Re-run on canvas re-mount (now empty as canvasKey is removed)

  useEffect(() => {
    const activeScene = scenes.find(s => s.id === settings.currentSceneId);
    if (!animationFrameIdRef.current && !settings.panicMode && activeScene) { 
      animationFrameIdRef.current = requestAnimationFrame(drawLoop);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [drawLoop, settings.panicMode, settings.currentSceneId, scenes]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" />
      <BrandingOverlay />
      <WebcamFeed onWebcamElement={setWebcamElement} />
    </div>
  );
}
