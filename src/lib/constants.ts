
import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets } from '@/types';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

export const FFT_SIZES = [128, 256, 512] as const;

// SBNF Palette HSL (from the branding guide)
const SBNF_HUES_SCENE = {
  black: 0, // #000000
  orangeRed: 13, // #FF441A
  orangeYellow: 36, // #FDB143
  lightPeach: 30, // #FFECDA
  lightLavender: 267, // #E1CCFF
  deepPurple: 258, // #5A36BB
  tronBlue: 197, 
};

// Helper to convert HSL to RGB (for shader uniforms or direct color setting)
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)]; // R, G, B
}

// SBNF "Cosmic Grapevines" Themed Defaults
export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1.0,
  enableAgc: true,
  gamma: 1.0,
  dither: 0.0,
  brightCap: 1.0,
  logoOpacity: 0.25,
  showWebcam: false,
  mirrorWebcam: true,
  currentSceneId: 'radial_burst', 
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse',
    speed: 1,
    color: '#FF441A', 
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500,
  sceneTransitionActive: true,
  monitorAudio: false,
  selectedAudioInputDeviceId: undefined,
  enableAiOverlay: false,
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent",
  enablePeriodicAiOverlay: false,
  aiOverlayRegenerationInterval: 45,
};


export const INITIAL_AUDIO_DATA: AudioData = {
  spectrum: new Uint8Array(DEFAULT_SETTINGS.fftSize / 2).fill(0),
  bassEnergy: 0,
  midEnergy: 0,
  trebleEnergy: 0,
  rms: 0,
  bpm: 120,
  beat: false,
};

export const SCENES: SceneDefinition[] = [
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror', 
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(new THREE.Color(SBNF_HUES_SCENE.deepPurple).getHex(), 1);

      const webGLAssets: Partial<WebGLSceneAssets> & { planeMesh?: THREE.Mesh, videoTexture?: THREE.VideoTexture, shaderMaterial?: THREE.ShaderMaterial } = { scene, camera, renderer };

      if (webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA && webcamElement.videoWidth > 0) {
        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        webGLAssets.videoTexture = videoTexture;

        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);
        
        const vertexShader = `
          varying vec2 vUv;
          uniform bool mirrorX;
          void main() {
            vUv = uv;
            if (mirrorX) {
              vUv.x = 1.0 - vUv.x;
            }
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `;
        const fragmentShader = `
          uniform sampler2D webcamTexture;
          uniform vec3 dynamicColor;
          uniform float opacityFactor;
          varying vec2 vUv;

          void main() {
            vec4 webcamColor = texture2D(webcamTexture, vUv);
            // Basic difference blend: abs(webcamColor - dynamicColor)
            // For a more pronounced silhouette, we can increase contrast or use a threshold
            float luminance = dot(webcamColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 silhouetteColor = dynamicColor * (1.0 - step(0.4, luminance)); // Simple thresholding
            vec3 blendedColor = mix(webcamColor.rgb, silhouetteColor, 0.8); // Mix for some video texture

            gl_FragColor = vec4(blendedColor, webcamColor.a * opacityFactor);
          }
        `;

        const shaderMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            webcamTexture: { value: videoTexture },
            dynamicColor: { value: new THREE.Color(SBNF_HUES_SCENE.orangeYellow) },
            opacityFactor: { value: 1.0 },
            mirrorX: { value: settings.mirrorWebcam },
          },
          transparent: true,
        });
        webGLAssets.shaderMaterial = shaderMaterial;

        const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        webGLAssets.planeMesh = planeMesh;
      } else {
         renderer.clear(); // Clear to background if webcam not ready
      }
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement }) => {
      if (!webGLAssets || !webGLAssets.shaderMaterial) {
         renderer.setClearColor(new THREE.Color(SBNF_HUES_SCENE.deepPurple).getHex(), 1);
         renderer.clear();
         return;
      }

      const { shaderMaterial, videoTexture } = webGLAssets;

      if (videoTexture && webcamElement && webcamElement.readyState >= webcamElement.HAVE_ENOUGH_DATA) {
        videoTexture.needsUpdate = true;
      }

      shaderMaterial.uniforms.mirrorX.value = settings.mirrorWebcam;
      shaderMaterial.uniforms.opacityFactor.value = Math.max(0.1, settings.brightCap * (0.85 + audioData.rms * 0.15));

      const baseAccentHue = SBNF_HUES_SCENE.orangeYellow;
      const energyColorHue = (baseAccentHue + audioData.bassEnergy * 40 + audioData.midEnergy * 20 + performance.now() / 80) % 360;
      const [r, g, b] = hslToRgb(energyColorHue, 90, 70);
      shaderMaterial.uniforms.dynamicColor.value.setRGB(r, g, b);
      
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.videoTexture) webGLAssets.videoTexture.dispose();
        if (webGLAssets.planeMesh) {
          if (webGLAssets.planeMesh.geometry) webGLAssets.planeMesh.geometry.dispose();
          // ShaderMaterial itself doesn't have a dispose method, its textures/uniforms do
        }
        if (webGLAssets.shaderMaterial) {
            // ShaderMaterial.dispose() is called automatically by WebGLRenderer when no longer used,
            // but explicit disposal of textures is good.
        }
      }
    },
  },
   {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes', // SBNF Orange-Red on Cream
    dataAiHint: 'glowing orbs abstract shapes',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x000000, 0); // Transparent clear for layering if needed

      const circleGeom = new THREE.CircleGeometry(0.5, 32);
      const squareGeom = new THREE.PlaneGeometry(1, 1);
      const triangleShape = new THREE.Shape();
      triangleShape.moveTo(0, 0.5);
      triangleShape.lineTo(0.5 * Math.cos(Math.PI/6 + Math.PI/2), -0.5 * Math.sin(Math.PI/6 + Math.PI/2));
      triangleShape.lineTo(0.5 * Math.cos(5*Math.PI/6 + Math.PI/2), -0.5 * Math.sin(5*Math.PI/6 + Math.PI/2));
      triangleShape.closePath();
      const triangleGeom = new THREE.ShapeGeometry(triangleShape);
      
      const geometries = [circleGeom, squareGeom, triangleGeom];

      return {
        scene,
        camera,
        renderer,
        geometries,
        activeShapes: [], // To store { mesh, lifetime, initialScale, rotationSpeed }
        lastSpawnTime: 0,
        spawnInterval: 100, // ms
        shapeBaseLifetime: 2500, // ms
        lastFrameTime: performance.now(),
        tempColor: new THREE.Color(),
      } as WebGLSceneAssets & { geometries: THREE.BufferGeometry[], activeShapes: any[], lastSpawnTime: number, spawnInterval: number, shapeBaseLifetime: number, lastFrameTime: number, tempColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const { geometries, activeShapes, shapeBaseLifetime, tempColor } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // seconds
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearColor(new THREE.Color(SBNF_HUES_SCENE.deepPurple).getHex(), settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.08 : 0.05);
      renderer.clear();

      const spawnCondition = audioData.beat || (audioData.rms > 0.02 && currentTime - webGLAssets.lastSpawnTime > webGLAssets.spawnInterval);
      
      if (spawnCondition && activeShapes.length < 100) { // Cap max shapes
        webGLAssets.lastSpawnTime = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 5 + audioData.bassEnergy * 3);

        for (let k = 0; k < numToSpawn; k++) {
          const geom = geometries[Math.floor(Math.random() * geometries.length)];
          const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
          const mesh = new THREE.Mesh(geom, material);

          const sizeBase = (15 + audioData.bassEnergy * 150 + Math.random() * 60);
          const initialScale = sizeBase * settings.brightCap * (0.3 + audioData.midEnergy * 0.7);
          if (initialScale < 4) continue;

          mesh.position.set(
            (Math.random() - 0.5) * canvasWidth * 0.9,
            (Math.random() - 0.5) * canvasHeight * 0.9,
            0
          );
          mesh.scale.set(initialScale * 0.1, initialScale * 0.1, 1); // Start small for grow-in

          const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
          const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
          const [r,g,b] = hslToRgb(hue, 80 + Math.random()*20, 60 + Math.random()*20);
          material.color.setRGB(r,g,b);

          const lifetime = shapeBaseLifetime * (0.5 + Math.random() * 0.5);
          const growInDuration = 300; // ms for initial growth

          activeShapes.push({ 
            mesh, 
            spawnTime: currentTime, 
            lifetime, 
            initialScale, 
            rotationSpeed: (Math.random() - 0.5) * 2.0 * deltaTime,
            growInDuration
          });
          scene.add(mesh);
        }
      }

      // Animate and remove old shapes
      for (let i = activeShapes.length - 1; i >= 0; i--) {
        const shape = activeShapes[i];
        const age = currentTime - shape.spawnTime;

        if (age > shape.lifetime) {
          scene.remove(shape.mesh);
          if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose();
          // Geometry is shared, no need to dispose per instance unless cloned
          activeShapes.splice(i, 1);
          continue;
        }
        
        const lifeProgress = age / shape.lifetime;
        const growInPhase = Math.min(1.0, age / shape.growInDuration);

        let currentScaleFactor = growInPhase; // Initial grow-in
        if (age > shape.growInDuration) { // Gentle pulsing after initial growth
          currentScaleFactor = 1 + Math.sin( (age - shape.growInDuration) * 0.005 * (1 + audioData.midEnergy) ) * 0.15;
        }
        const finalScale = shape.initialScale * currentScaleFactor;
        shape.mesh.scale.set(finalScale, finalScale, finalScale);
        
        // Fade out
        const targetOpacity = (0.3 + audioData.trebleEnergy * 0.7 + audioData.rms * 0.5) * settings.brightCap;
        (shape.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1.0 - lifeProgress) * targetOpacity * growInPhase);
        
        shape.mesh.rotation.z += shape.rotationSpeed;
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        webGLAssets.activeShapes.forEach((shape: any) => {
          if (webGLAssets.scene) webGLAssets.scene.remove(shape.mesh);
          if (shape.mesh.material) shape.mesh.material.dispose();
        });
        webGLAssets.activeShapes = [];
        webGLAssets.geometries.forEach((geom: THREE.BufferGeometry) => geom.dispose());
      }
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings', // SBNF Orange-Yellow on Black
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);

        const ringGeometry = new THREE.RingGeometry(0.95, 1, 64); // Inner radius, outer radius, segments
        const webGLAssets: Partial<WebGLSceneAssets> & { activeRings?: any[], ringGeometry?: THREE.BufferGeometry, lastSpawnTimes?: number[], tempColor?: THREE.Color } = { 
            scene, camera, renderer, activeRings: [], ringGeometry, lastSpawnTimes: [0,0,0], tempColor: new THREE.Color()
        };
        return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets.ringGeometry || !webGLAssets.activeRings || !webGLAssets.lastSpawnTimes || !webGLAssets.tempColor) return;

        const { ringGeometry, activeRings, lastSpawnTimes, tempColor } = webGLAssets;
        const currentTime = performance.now();

        renderer.setClearColor(new THREE.Color(SBNF_HUES_SCENE.deepPurple).getHex(), settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.1);
        renderer.clear();

        const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
        const baseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
        const spawnIntervals = [150, 120, 100]; // ms
        const maxRingRadius = Math.min(canvasWidth, canvasHeight) * 0.48;

        energies.forEach((energy, i) => {
            if (energy > 0.05 && currentTime - lastSpawnTimes[i] > spawnIntervals[i] / (energy + 0.1)) {
                lastSpawnTimes[i] = currentTime;
                
                const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
                const ringMesh = new THREE.Mesh(ringGeometry, material);
                
                const hue = (baseHues[i] + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 50 + (audioData.beat ? 20 : 0)) % 360;
                const [r,g,b] = hslToRgb(hue, 90 + energy*10, 65 + energy*15);
                tempColor.setRGB(r,g,b);
                material.color.copy(tempColor);
                
                activeRings.push({ 
                    mesh: ringMesh, 
                    spawnTime: currentTime, 
                    lifetime: 1500 + energy * 1000, // ms
                    maxRadius: maxRingRadius * (0.3 + energy * 0.7),
                    initialThickness: (2 + energy * 20 + (audioData.beat ? 5.0 : 0)) * settings.brightCap
                });
                scene.add(ringMesh);
            }
        });

        for (let i = activeRings.length - 1; i >= 0; i--) {
            const ring = activeRings[i];
            const age = currentTime - ring.spawnTime;

            if (age > ring.lifetime) {
                scene.remove(ring.mesh);
                if (ring.mesh.material) (ring.mesh.material as THREE.Material).dispose();
                activeRings.splice(i, 1);
                continue;
            }

            const lifeProgress = age / ring.lifetime;
            const currentRadius = lifeProgress * ring.maxRadius;
            if (currentRadius < 1) continue;

            const thicknessFactor = Math.max(0.005, ring.initialThickness / currentRadius); // Keep line somewhat constant apparent width
            ring.mesh.scale.set(currentRadius, currentRadius, 1);
            // RingGeometry is 0.95 to 1. To make it thicker, scale it non-uniformly or use a different geometry approach (e.g. fat lines / tubes)
            // For simplicity with RingGeometry, we adjust opacity and base material.
            // A more advanced method would use custom shaders or LineMaterial.

            const alpha = (1.0 - lifeProgress) * (0.5 + audioData.rms * 0.5) * settings.brightCap * 1.5;
            (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, alpha));
        }
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.activeRings) {
                webGLAssets.activeRings.forEach((ring: any) => {
                    if (webGLAssets.scene) webGLAssets.scene.remove(ring.mesh);
                    if (ring.mesh.material) (ring.mesh.material as THREE.Material).dispose();
                });
                webGLAssets.activeRings = [];
            }
            if (webGLAssets.ringGeometry) webGLAssets.ringGeometry.dispose();
        }
    },
  },
   {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid', // SBNF Light Lavender on Deep Purple
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);

        const GRID_SIZE = 16; // Or make dynamic based on settings.fftSize or canvas aspect
        const cellGeom = new THREE.PlaneGeometry(1, 1); // Base cell
        const instancedMesh = new THREE.InstancedMesh(cellGeom, new THREE.MeshBasicMaterial({vertexColors: true, transparent: true}), GRID_SIZE * GRID_SIZE);
        scene.add(instancedMesh);

        const cellWidth = canvas.width / GRID_SIZE;
        const cellHeight = canvas.height / GRID_SIZE;
        const dummy = new THREE.Object3D();
        const initialColor = new THREE.Color(SBNF_HUES_SCENE.deepPurple);
        const cellStates = [];

        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                const index = i * GRID_SIZE + j;
                dummy.position.set(
                    (i - GRID_SIZE / 2 + 0.5) * cellWidth,
                    (j - GRID_SIZE / 2 + 0.5) * cellHeight,
                    0
                );
                dummy.scale.set(cellWidth * 0.85, cellHeight * 0.85, 1); // Add some padding
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
                instancedMesh.setColorAt(index, initialColor);
                cellStates.push({ currentColor: new THREE.Color().copy(initialColor), targetColor: new THREE.Color().copy(initialColor), lastUpdateTime: 0 });
            }
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;


        return {
            scene, camera, renderer, instancedMesh, GRID_SIZE, cellWidth, cellHeight, cellStates, tempColor: new THREE.Color(), lastFrameTime: performance.now(),
            bgColor: new THREE.Color(SBNF_HUES_SCENE.deepPurple)
        } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, GRID_SIZE: number, cellWidth: number, cellHeight: number, cellStates: any[], tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets.instancedMesh || !webGLAssets.cellStates) return;
        const { instancedMesh, GRID_SIZE, cellStates, tempColor, bgColor } = webGLAssets;
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0;
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearColor(bgColor, settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.28 : 0.22);
        renderer.clear();

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;
        const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                const index = i * GRID_SIZE + j;
                const spectrumIndex = index % spectrumLength;
                const energy = spectrum[spectrumIndex] / 255;
                const cellState = cellStates[index];

                const beatFactor = audioData.beat ? 1.5 : 1.0;
                const targetLightness = 0.45 + energy * 0.3 * beatFactor;
                const targetSaturation = 0.8 + energy * 0.2;
                
                const baseHue = sbnfHues[(i + j + Math.floor(currentTime / 2000)) % sbnfHues.length];
                const hue = (baseHue + energy * 60 + (audioData.beat ? 20 : 0)) % 360;

                const [r,g,b] = hslToRgb(hue, targetSaturation*100, targetLightness*100);
                cellState.targetColor.setRGB(r,g,b);
                
                cellState.currentColor.lerp(cellState.targetColor, 0.15); // Smooth transition
                instancedMesh.setColorAt(index, cellState.currentColor);
                
                // Optional: Pulse scale
                const dummy = new THREE.Object3D();
                instancedMesh.getMatrixAt(index, dummy.matrix);
                const baseScale = webGLAssets.cellWidth * 0.85;
                const scalePulse = 1.0 + energy * 0.2 * beatFactor * audioData.rms;
                dummy.scale.set(baseScale * scalePulse, baseScale * scalePulse, 1);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
            }
        }
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        instancedMesh.instanceMatrix.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets && webGLAssets.instancedMesh) {
            if (webGLAssets.instancedMesh.geometry) webGLAssets.instancedMesh.geometry.dispose();
            if (webGLAssets.instancedMesh.material) (webGLAssets.instancedMesh.material as THREE.Material).dispose();
            if (webGLAssets.scene) webGLAssets.scene.remove(webGLAssets.instancedMesh);
        }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars', // SBNF Deep Purple on Orange-Yellow
    dataAiHint: 'audio spectrum analysis',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = 'hsl(var(--background-hsl))'; // SBNF Deep Purple
      ctx.fillRect(0,0,width,height);

      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5);

      if (isAudioSilent) {
        ctx.fillStyle = `hsl(var(--foreground-hsl))`;
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const barWidth = width / audioData.spectrum.length;
        ctx.strokeStyle = 'hsla(var(--muted-foreground-hsl), 0.2)';
        ctx.lineWidth = 1;
        for (let k = 0; k < audioData.spectrum.length; k++) {
          ctx.strokeRect(k * barWidth, height - (height * 0.03), barWidth -1 , (height * 0.03));
        }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      const effectiveBrightCap = Math.max(0.1, settings.brightCap);
      const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        const barHeightBase = normalizedValue * height * effectiveBrightCap * 1.3;
        const barHeight = Math.max(0.5, barHeightBase * (0.4 + audioData.rms * 0.6 + (audioData.beat ? 0.25 : 0) ) );

        const hueIndex = Math.floor((i / audioData.spectrum.length) * sbnfHues.length);
        const baseHue = sbnfHues[hueIndex % sbnfHues.length];
        const hue = (baseHue + normalizedValue * 30 + (audioData.beat ? 20 : 0) + performance.now()/200) % 360;

        const saturation = 85 + normalizedValue * 15;
        const lightness = 40 + normalizedValue * 35 + (audioData.beat ? 10 : 0);

        ctx.fillStyle = `hsl(${hue}, ${Math.min(100, saturation)}%, ${Math.min(85, lightness)}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 0.5, barHeight); 

        if (normalizedValue > 0.35) {
          ctx.fillStyle = `hsla(${(hue + 25) % 360}, ${saturation + 10}%, ${lightness + 25}%, 0.65)`;
          ctx.fillRect(i * barWidth, height - barHeight * 1.05, barWidth - 1.2, barHeight * 0.25);
        }
      });
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst', // SBNF Orange-Red on Black
    dataAiHint: 'abstract explosion particles',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 300;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);

      const PARTICLE_COUNT = 5000; // Max particles
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); // Store x, y, z velocity
      const lifetimes = new Float32Array(PARTICLE_COUNT); // Store remaining lifetime

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes[i] = 0; // Start dead
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 3, // Base size, can be modulated
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      return {
        scene, camera, renderer, particles, material, geometry,
        positions, colors, velocities, lifetimes,
        PARTICLE_COUNT,
        lastBeatTime: 0,
        lastAmbientSpawnTime: 0,
        tempColor: new THREE.Color(),
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
      } as WebGLSceneAssets & { particles: THREE.Points, material: THREE.PointsMaterial, geometry: THREE.BufferGeometry, positions: Float32Array, colors: Float32Array, velocities: Float32Array, lifetimes: Float32Array, PARTICLE_COUNT: number, lastBeatTime: number, lastAmbientSpawnTime: number, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      const { particles, material, geometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0;
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearColor(bgColor, settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.18 : 0.15);
      renderer.clear();
      
      const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
      let spawnedThisFrame = 0;

      // Beat Burst
      const beatCooldown = 100; // ms
      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
        webGLAssets.lastBeatTime = currentTime;
        let burstCount = 0;
        const maxBurstParticles = Math.floor(PARTICLE_COUNT * 0.4); // Burst up to 40% of particles
        for (let i = 0; i < PARTICLE_COUNT && burstCount < maxBurstParticles; i++) {
          if (lifetimes[i] <= 0) { // Find a dead particle
            positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 100 + Math.random() * 200 + audioData.bassEnergy * 300 + audioData.rms * 150;
            velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
            velocities[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
            velocities[i * 3 + 2] = speed * Math.cos(phi);
            
            const hue = sbnfHues[Math.floor(Math.random() * 2)]; // Orange-Red or Orange-Yellow for burst
            const [r,g,b] = hslToRgb(hue, 100, 60 + Math.random()*15);
            tempColor.setRGB(r,g,b);
            colors[i*3] = tempColor.r; colors[i*3+1] = tempColor.g; colors[i*3+2] = tempColor.b;

            lifetimes[i] = 1.0 + Math.random() * 1.5; // 1 to 2.5 seconds
            burstCount++;
            spawnedThisFrame++;
          }
        }
      }

      // Ambient Sparkle
      const ambientSpawnRate = 50 + audioData.rms * 200; // particles per second
      const ambientSpawnInterval = 1000 / ambientSpawnRate;
      if (currentTime - webGLAssets.lastAmbientSpawnTime > ambientSpawnInterval && spawnedThisFrame < PARTICLE_COUNT * 0.1) {
          webGLAssets.lastAmbientSpawnTime = currentTime;
          for (let i = 0; i < PARTICLE_COUNT; i++) {
              if (lifetimes[i] <= 0) { // Find a dead particle for ambient
                  positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
                  const theta = Math.random() * Math.PI * 2;
                  const phi = Math.acos(2 * Math.random() - 1);
                  const speed = 20 + Math.random() * 50 + audioData.midEnergy * 80;
                  velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
                  velocities[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
                  velocities[i * 3 + 2] = speed * Math.cos(phi);

                  const hue = sbnfHues[2]; // Light Lavender for ambient
                  const [r,g,b] = hslToRgb(hue, 80 + Math.random()*20, 50 + Math.random()*20);
                  tempColor.setRGB(r,g,b);
                  colors[i*3] = tempColor.r; colors[i*3+1] = tempColor.g; colors[i*3+2] = tempColor.b;
                  
                  lifetimes[i] = 1.5 + Math.random() * 2.0; // 1.5 to 3.5 seconds
                  spawnedThisFrame++;
                  break; 
              }
          }
      }

      // Update particles
      const dragFactor = 0.97;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (lifetimes[i] > 0) {
          lifetimes[i] -= deltaTime;
          if (lifetimes[i] <= 0) {
            colors[i*3+0] = 0; colors[i*3+1] = 0; colors[i*3+2] = 0; // Effectively hide
            continue;
          }
          
          velocities[i * 3] *= dragFactor;
          velocities[i * 3 + 1] *= dragFactor;
          velocities[i * 3 + 2] *= dragFactor;

          positions[i * 3] += velocities[i * 3] * deltaTime;
          positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime;
          positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime;
          
          // Fade color (darken) as lifetime decreases
          const lifeRatio = Math.max(0, lifetimes[i] / (1.0 + Math.random() * 1.5)); // Normalize initial lifetime variation
          colors[i*3+0] *= lifeRatio;
          colors[i*3+1] *= lifeRatio;
          colors[i*3+2] *= lifeRatio;
        }
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      material.size = (2.0 + audioData.rms * 5.0) * Math.max(0.1, settings.brightCap);
      material.opacity = Math.max(0.1, settings.brightCap * (0.5 + audioData.rms * 0.5));

    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.geometry) webGLAssets.geometry.dispose();
            if (webGLAssets.material) webGLAssets.material.dispose();
            // Particles are part of the scene, will be removed when scene is cleared or new scene loaded
        }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel', // SBNF Deep Purple on Orange-Red
    dataAiHint: 'geometric tunnel flight tron',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(SBNF_HUES_SCENE.black, 1); // Use SBNF black

      const numSegments = 20;
      const segmentDepth = 100; // Depth of each segment
      const segmentRadius = 150; // Radius of tunnel
      const segments = [];
      const segmentGeometry = new THREE.TorusGeometry(segmentRadius, 3, 16, 64); // radius, tube, radialSegments, tubularSegments

      for (let i = 0; i < numSegments; i++) {
        const material = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.8 });
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * segmentDepth;
        segment.rotation.x = Math.PI / 2; // Orient rings correctly
        scene.add(segment);
        segments.push(segment);
      }
      camera.position.z = segmentDepth; // Start inside the first segment

      return {
        scene, camera, renderer, segments, numSegments, segmentDepth,
        segmentSpeed: 150, // units per second
        cameraBaseFov: 75,
        tempColor: new THREE.Color(),
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
      } as WebGLSceneAssets & { segments: THREE.Mesh[], numSegments: number, segmentDepth: number, segmentSpeed: number, cameraBaseFov: number, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.segments || !webGLAssets.cameraBaseFov || !webGLAssets.tempColor) {
        if (renderer) { 
            const bgColor = webGLAssets?.bgColor || new THREE.Color(SBNF_HUES_SCENE.black);
            renderer.setClearColor(bgColor, 1);
            renderer.clear();
        }
        return;
      }

      const { segments, segmentDepth, numSegments, segmentSpeed, cameraBaseFov, tempColor } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000; 
      webGLAssets.lastFrameTime = currentTime;

      // Animate segments (movement, color, rotation)
      segments.forEach((segment: THREE.Mesh, i: number) => {
        // Move segment towards camera based on camera's effective forward speed
        segment.position.z += segmentSpeed * (1 + audioData.rms * 1.5) * deltaTime;

        // Recycle segment if it's behind the camera
        if (segment.position.z > camera.position.z + segmentDepth / 2) {
          segment.position.z -= numSegments * segmentDepth; 
        }

        let targetHue;
        const hueOptions = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.lightLavender]; // Tron-like palette
        const baseHue = hueOptions[(i + Math.floor(currentTime * 0.0002)) % hueOptions.length]; 

        const audioInfluence = audioData.rms * 60 + (audioData.spectrum[i % audioData.spectrum.length] / 255) * 40;
        targetHue = (baseHue + audioInfluence + (audioData.beat ? 30 : 0)) % 360;

        const lightness = 0.5 + audioData.rms * 0.3 + (audioData.beat ? 0.25 : 0) + settings.brightCap * 0.1;
        const [r,g,bVal] = hslToRgb(targetHue, 95, Math.min(0.80, lightness)); // High saturation for Tron glow
        tempColor.setRGB(r,g,bVal);
        
        if (segment.material instanceof THREE.MeshBasicMaterial) {
            segment.material.color.copy(tempColor); 
            segment.material.opacity = Math.min(0.9, 0.55 + audioData.rms * 0.4 + settings.brightCap * 0.15);
        }
        
        segment.rotation.z += (audioData.trebleEnergy * 0.03 + 0.0005 + audioData.bpm * 0.000015) * (i % 2 === 0 ? 1.1 : -1.3) * deltaTime * 60;
        segment.rotation.y = Math.sin(currentTime * 0.0005 + i * 0.4) * audioData.midEnergy * 0.4; 
      });

      // Camera FOV effect
      if (camera instanceof THREE.PerspectiveCamera) { 
        camera.fov = cameraBaseFov - audioData.rms * 30 * settings.gamma + (audioData.beat ? 6 : 0);
        camera.fov = Math.max(40, Math.min(100, camera.fov));
        camera.updateProjectionMatrix();
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets && webGLAssets.segments && webGLAssets.scene) {
        webGLAssets.segments.forEach((segment: THREE.Mesh) => {
          if (segment.geometry) segment.geometry.dispose();
          if (segment.material) (segment.material as THREE.Material).dispose();
          if (webGLAssets.scene) webGLAssets.scene.remove(segment);
        });
        webGLAssets.segments = [];
      }
    },
  },
   {
    id: 'strobe_light',
    name: 'Strobe Light',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe', // SBNF Cream on Black
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
        const lightness = 80 + Math.random() * 15; // Ensure bright flash
        ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${Math.min(1, settings.brightCap * 1.2)})`; // Use brightCap and ensure high opacity
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = 'hsl(var(--background-hsl))'; 
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale', // SBNF Orange-Yellow on Deep Purple
    dataAiHint: 'grand particle explosion confetti fireworks',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 400;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);

      const PARTICLE_COUNT = 3500; // Reduced from 8000
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT); // 0 = dead, >0 = alive

      for (let i = 0; i < PARTICLE_COUNT; i++) {
          lifetimes[i] = 0; // All particles start dead
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const material = new THREE.PointsMaterial({
        size: 2.5, // Reduced base size
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);
      
      return {
        scene, camera, renderer, particles, material, geometry,
        positions, colors, velocities, lifetimes,
        PARTICLE_COUNT,
        lastBeatTime: 0,
        tempColor: new THREE.Color(),
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // Finale against black
        rotationSpeed: new THREE.Vector3(0.02, 0.03, 0.01), // Slower base rotation
      } as WebGLSceneAssets & { particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; PARTICLE_COUNT: number; lastBeatTime: number; tempColor: THREE.Color; lastFrameTime: number; bgColor: THREE.Color; rotationSpeed: THREE.Vector3; };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
        const { particles, material, geometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor, rotationSpeed } = webGLAssets;
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // seconds
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearColor(bgColor, settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.15 : 0.1);
        renderer.clear();

        const beatCooldown = 150; // ms, slightly longer to make bursts more distinct
        const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
        
        if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            let particlesToSpawn = Math.floor(PARTICLE_COUNT * (0.2 + audioData.bassEnergy * 0.4)); // Spawn up to 60%
            particlesToSpawn = Math.min(particlesToSpawn, PARTICLE_COUNT * 0.5); // Cap spawn per beat

            for (let i = 0; i < PARTICLE_COUNT && particlesToSpawn > 0; i++) {
                if (lifetimes[i] <= 0) { // Find a "dead" particle
                    // Position slightly randomized around center
                    positions[i * 3] = (Math.random() - 0.5) * 20;
                    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
                    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1.0); 
                    const speed = 150 + Math.random() * 250 + audioData.bassEnergy * 400 + audioData.rms * 200;
                    velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[i * 3 + 2] = speed * Math.cos(phi);
                    
                    const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
                    const [r,g,b] = hslToRgb(hue, 95 + Math.random() * 5, 60 + Math.random() * 20); // Slightly less max lightness
                    tempColor.setRGB(r,g,b);
                    colors[i*3] = tempColor.r; colors[i*3+1] = tempColor.g; colors[i*3+2] = tempColor.b;
                    
                    lifetimes[i] = 1.2 + Math.random() * 1.8; // Lifetime 1.2s to 3s
                    particlesToSpawn--;
                }
            }
        }

        const dragFactor = 0.96; // Slightly stronger drag
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (lifetimes[i] > 0) {
                lifetimes[i] -= deltaTime;
                if (lifetimes[i] <= 0) {
                    colors[i*3+0] = 0; colors[i*3+1] = 0; colors[i*3+2] = 0; // Make invisible
                    velocities[i*3] = 0; velocities[i*3+1] = 0; velocities[i*3+2] = 0;
                    continue;
                }
                
                velocities[i*3] *= dragFactor; velocities[i*3+1] *= dragFactor; velocities[i*3+2] *= dragFactor;
                positions[i*3] += velocities[i*3] * deltaTime;
                positions[i*3+1] += velocities[i*3+1] * deltaTime;
                positions[i*3+2] += velocities[i*3+2] * deltaTime;
                
                const lifeRatio = Math.max(0, lifetimes[i] / (1.2 + Math.random() * 1.8)); // Normalize for initial lifetime
                colors[i*3+0] *= (0.5 + lifeRatio * 0.5); // Fade by darkening
                colors[i*3+1] *= (0.5 + lifeRatio * 0.5);
                colors[i*3+2] *= (0.5 + lifeRatio * 0.5);
            }
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        
        material.size = (1.5 + audioData.rms * 4.0) * Math.max(0.1, settings.brightCap); // Smaller base, more reactive
        material.opacity = Math.max(0.1, settings.brightCap * (0.4 + audioData.rms * 0.6)); // Slightly less base opacity

        // Gentle overall rotation
        particles.rotation.x += rotationSpeed.x * deltaTime * (0.5 + audioData.midEnergy);
        particles.rotation.y += rotationSpeed.y * deltaTime * (0.5 + audioData.trebleEnergy);
        
        // Camera pullback on RMS
        camera.position.z = 400 + audioData.rms * 300;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.geometry) webGLAssets.geometry.dispose();
            if (webGLAssets.material) webGLAssets.material.dispose();
        }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";
