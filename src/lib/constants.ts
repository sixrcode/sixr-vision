
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
  tronBlue: 197, // A common Tron-like blue
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

export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1.0,
  enableAgc: true,
  gamma: 1.0,
  dither: 0.0,
  brightCap: 1.0,
  logoOpacity: 0.25,
  showWebcam: false, // Default to false, user explicitly enables
  mirrorWebcam: true,
  currentSceneId: 'radial_burst', // SBNF "Cosmic Grapevines" default
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse', // Default to pulse for SBNF
    speed: 1,
    color: '#FF441A', // SBNF Orange-Red
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
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent", // SBNF themed
  enablePeriodicAiOverlay: false,
  aiOverlayRegenerationInterval: 45, // Default interval in seconds
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins', // SBNF Purple/Cream
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      // Use OrthographicCamera for full-screen 2D effects
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1; // Position camera

      const webGLAssets: Partial<WebGLSceneAssets> & { planeMesh?: THREE.Mesh, videoTexture?: THREE.VideoTexture, shaderMaterial?: THREE.ShaderMaterial, bgColor?: THREE.Color } = { scene, camera, bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`) };

      if (webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0) {
        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.colorSpace = THREE.SRGBColorSpace; // Important for correct color
        webGLAssets.videoTexture = videoTexture;

        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);

        // Shaders for silhouette and audio-reactive effects
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
          uniform vec3 dynamicColor; // Color for silhouette effect
          uniform float opacityFactor; // Overall opacity
          varying vec2 vUv;

          void main() {
            vec4 webcamColor = texture2D(webcamTexture, vUv);
            float luminance = dot(webcamColor.rgb, vec3(0.299, 0.587, 0.114));
            
            // Create a silhouette effect using the dynamicColor
            vec3 silhouetteColor = dynamicColor * (1.0 - step(0.45, luminance)); // Step function for harder silhouette
            
            // Mix original color subtly with the silhouette for some detail
            vec3 finalColor = mix(webcamColor.rgb * 0.3, silhouetteColor, 0.85);

            gl_FragColor = vec4(finalColor, webcamColor.a * opacityFactor);
          }
        `;

        const shaderMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            webcamTexture: { value: videoTexture },
            dynamicColor: { value: new THREE.Color(`hsl(${SBNF_HUES_SCENE.orangeRed}, 100%, 55%)`) }, // Start with SBNF Orange-Red
            opacityFactor: { value: 1.0 },
            mirrorX: { value: settings.mirrorWebcam },
          },
          transparent: true,
          depthWrite: false, // Important for transparent overlays
        });
        webGLAssets.shaderMaterial = shaderMaterial;

        const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        webGLAssets.planeMesh = planeMesh;
      } else {
        console.log("[Mirror Silhouette] Webcam not ready for initWebGL.");
      }
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      if (!renderer || !webGLAssets) return;
      const { planeMesh, shaderMaterial, videoTexture, bgColor } = webGLAssets as any; // Cast for easier access

      if (planeMesh && shaderMaterial && videoTexture && settings.showWebcam && webcamElement && webcamElement.readyState >= webcamElement.HAVE_ENOUGH_DATA) {
        renderer.setClearAlpha(0); // Ensure main renderer is transparent if we are showing video
        videoTexture.needsUpdate = true;
        shaderMaterial.uniforms.mirrorX.value = settings.mirrorWebcam;
        
        // Opacity based on brightCap and RMS
        const overallOpacity = Math.max(0.1, settings.brightCap * (0.7 + audioData.rms * 0.3));
        shaderMaterial.uniforms.opacityFactor.value = overallOpacity;

        // Audio-reactive color for the silhouette effect, using SBNF accents
        const hueTimeShift = (performance.now() / 12000) * 360; // Slow hue shift over time
        const baseHue = (SBNF_HUES_SCENE.lightLavender + audioData.midEnergy * 60 + hueTimeShift) % 360;
        const saturation = 70 + audioData.trebleEnergy * 30;
        const lightness = 50 + audioData.bassEnergy * 25 + (audioData.beat ? 10 : 0); // More pronounced beat effect
        const [r, g, b] = hslToRgb(baseHue, saturation, lightness);
        shaderMaterial.uniforms.dynamicColor.value.setRGB(r, g, b);
        
        // Cover scaling logic for the video texture on the plane
        const canvasAspect = canvasWidth / canvasHeight;
        const videoAspect = webcamElement.videoWidth / webcamElement.videoHeight;
        
        // Update plane geometry if canvas size changed significantly (more robust check might be needed)
        if (planeMesh.geometry.parameters.width !== canvasWidth || planeMesh.geometry.parameters.height !== canvasHeight) {
            planeMesh.geometry.dispose();
            planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
        }

        if (canvasAspect > videoAspect) { // Canvas is wider
            videoTexture.repeat.x = videoAspect / canvasAspect;
            videoTexture.repeat.y = 1;
            videoTexture.offset.x = (1 - videoTexture.repeat.x) / 2;
            videoTexture.offset.y = 0;
        } else { // Canvas is taller or same aspect
            videoTexture.repeat.x = 1;
            videoTexture.repeat.y = canvasAspect / videoAspect;
            videoTexture.offset.x = 0;
            videoTexture.offset.y = (1 - videoTexture.repeat.y) / 2;
        }

      } else {
        // If webcam is not active, clear to background color
        renderer.setClearColor(bgColor ? bgColor.getHex() : new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`).getHex(), 1);
        renderer.clear();
        // Optionally, draw "Webcam not available or enabled" text using a separate 2D overlay canvas if needed
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if ((webGLAssets as any).videoTexture) (webGLAssets as any).videoTexture.dispose();
        if ((webGLAssets as any).planeMesh && (webGLAssets as any).planeMesh.geometry) (webGLAssets as any).planeMesh.geometry.dispose();
        if ((webGLAssets as any).shaderMaterial) (webGLAssets as any).shaderMaterial.dispose();
      }
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes&font=poppins', // SBNF Orange-Red on Cream
    dataAiHint: 'glowing orbs abstract shapes',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const circleGeom = new THREE.CircleGeometry(0.5, 32); // Unit radius
      const squareGeom = new THREE.PlaneGeometry(1, 1); // Unit square
      const triangleShape = new THREE.Shape();
      triangleShape.moveTo(0, 0.5); // Top vertex
      triangleShape.lineTo(0.5 * Math.cos(Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(Math.PI / 6 + Math.PI / 2)); // Bottom right
      triangleShape.lineTo(0.5 * Math.cos(5 * Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(5 * Math.PI / 6 + Math.PI / 2)); // Bottom left
      triangleShape.closePath();
      const triangleGeom = new THREE.ShapeGeometry(triangleShape);

      return {
        scene,
        camera,
        geometries: [circleGeom, squareGeom, triangleGeom],
        activeShapes: [],
        lastSpawnTime: 0,
        spawnInterval: 100, // Base interval in ms
        shapeBaseLifetime: 2500, // Base lifetime in ms
        lastFrameTime: performance.now(),
        tempColor: new THREE.Color(),
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`),
      } as WebGLSceneAssets & { geometries: THREE.BufferGeometry[], activeShapes: any[], lastSpawnTime: number, spawnInterval: number, shapeBaseLifetime: number, lastFrameTime: number, tempColor: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.geometries || !webGLAssets.activeShapes || !webGLAssets.bgColor || !webGLAssets.tempColor || !webGLAssets.lastFrameTime) return;
      const { geometries, activeShapes, shapeBaseLifetime, bgColor, tempColor } = webGLAssets as any;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime); // Delta time in ms
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearColor(bgColor.getHex(), 0.08); // Low alpha for trails
      renderer.clear();

      // Spawn new shapes
      const spawnInterval = (webGLAssets as any).spawnInterval / (1 + audioData.rms * 5); // Faster spawn with higher RMS
      const spawnCondition = audioData.beat || (audioData.rms > 0.015 && currentTime - (webGLAssets as any).lastSpawnTime > spawnInterval);

      if (spawnCondition && activeShapes.length < 80) { // Cap max shapes
        (webGLAssets as any).lastSpawnTime = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 3 + audioData.bassEnergy * 2 + (audioData.beat ? 2: 0));

        for (let k = 0; k < numToSpawn; k++) {
          const geom = geometries[Math.floor(Math.random() * geometries.length)];
          // Each shape needs its own material instance to control opacity independently
          const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geom, material);

          // Initial scale based on bass and brightCap
          const sizeBase = (10 + audioData.bassEnergy * 120 + Math.random() * 50);
          const initialScale = sizeBase * Math.max(0.1, settings.brightCap) * (0.25 + audioData.midEnergy * 0.75);
          if (initialScale < 3) continue; // Skip if too small

          mesh.position.set(
            (Math.random() - 0.5) * canvasWidth * 0.85,
            (Math.random() - 0.5) * canvasHeight * 0.85,
            0
          );
          mesh.scale.set(initialScale * 0.05, initialScale * 0.05, 1); // Start very small for grow-in

          // Color from SBNF palette, influenced by audio
          const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.tronBlue];
          const baseObjectHue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
          const hue = (baseObjectHue + (audioData.spectrum[k*5 % audioData.spectrum.length] / 255) * 30 + (audioData.beat ? 15:0) + performance.now()/300) % 360;

          const [r,g,bVal] = hslToRgb(hue, 85 + Math.random()*15, 55 + Math.random()*20);
          material.color.setRGB(r,g,bVal);

          const lifetime = shapeBaseLifetime * (0.6 + Math.random() * 0.8); // Randomized lifetime
          const growInDuration = 250 + Math.random() * 200;

          activeShapes.push({
            mesh,
            spawnTime: currentTime,
            lifetime,
            initialScale,
            rotationSpeed: (Math.random() - 0.5) * 0.0025 * (1 + audioData.trebleEnergy),
            growInDuration
          });
          scene.add(mesh);
        }
      }

      // Update active shapes
      for (let i = activeShapes.length - 1; i >= 0; i--) {
        const shape = activeShapes[i];
        const age = currentTime - shape.spawnTime;

        if (age > shape.lifetime) {
          scene.remove(shape.mesh);
          if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose();
          // Geometries are shared, so don't dispose of shape.mesh.geometry here
          activeShapes.splice(i, 1);
          continue;
        }

        const lifeProgress = age / shape.lifetime;
        const growInPhase = Math.min(1.0, age / shape.growInDuration);

        // Pulsating scale effect after grow-in
        let currentScaleFactor = growInPhase;
        if (age > shape.growInDuration) {
          // More pronounced pulsation with mid energy
          currentScaleFactor = 1 + Math.sin((age - shape.growInDuration) * 0.003 * (1 + audioData.midEnergy * 2)) * 0.12;
        }
        const finalScale = shape.initialScale * currentScaleFactor;
        shape.mesh.scale.set(finalScale, finalScale, finalScale);

        // Opacity fades out over life, influenced by grow-in and audio
        const targetOpacity = (0.25 + audioData.trebleEnergy * 0.5 + audioData.rms * 0.4) * settings.brightCap * 1.2;
        (shape.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, (1.0 - lifeProgress) * targetOpacity * growInPhase));

        shape.mesh.rotation.z += shape.rotationSpeed * deltaTime * 0.06; // Adjusted for ms deltaTime
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if ((webGLAssets as any).activeShapes) {
          (webGLAssets as any).activeShapes.forEach((shape: any) => {
            if ((webGLAssets as any).scene) (webGLAssets as any).scene.remove(shape.mesh);
            if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose();
            // Geometries are shared and disposed of below
          });
          (webGLAssets as any).activeShapes = [];
        }
        if ((webGLAssets as any).geometries) {
          (webGLAssets as any).geometries.forEach((geom: THREE.BufferGeometry) => geom.dispose());
        }
      }
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings&font=poppins', // SBNF Orange-Yellow on Black
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;

        const ringGeometry = new THREE.RingGeometry(0.98, 1, 64); // innerRadius, outerRadius, thetaSegments
        return {
            scene, camera,
            activeRings: [],
            ringGeometry, // Store the geometry to reuse
            lastSpawnTimes: [0,0,0], // For bass, mid, treble
            tempColor: new THREE.Color(),
            bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`),
        } as WebGLSceneAssets & { activeRings: any[], ringGeometry: THREE.BufferGeometry, lastSpawnTimes: number[], tempColor: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.ringGeometry || !webGLAssets.activeRings || !webGLAssets.lastSpawnTimes || !webGLAssets.tempColor || !webGLAssets.bgColor) return;
        const { ringGeometry, activeRings, lastSpawnTimes, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();

        renderer.setClearColor(bgColor.getHex(), 0.12); // Semi-transparent clear for motion blur
        renderer.clear();

        const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
        const baseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
        const spawnIntervals = [160, 130, 110]; // Base intervals in ms, faster for higher frequencies
        const maxRingRadius = Math.min(canvasWidth, canvasHeight) * 0.45; // Max expansion

        energies.forEach((energy, i) => {
            const effectiveEnergy = Math.max(0.01, energy); // Avoid division by zero or too slow spawns
            if (energy > 0.03 && currentTime - lastSpawnTimes[i] > spawnIntervals[i] / (effectiveEnergy * 5 + 0.1)) {
                lastSpawnTimes[i] = currentTime;

                const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, opacity: 0 });
                const ringMesh = new THREE.Mesh(ringGeometry, material);

                // Color based on frequency band and SBNF palette
                const hue = (baseHues[i] + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 40 + (audioData.beat ? 25 : 0) + performance.now()/400) % 360;
                const [r,g,bVal] = hslToRgb(hue, 90 + energy*10, 60 + energy*20);
                tempColor.setRGB(r,g,bVal);
                material.color.copy(tempColor);

                activeRings.push({
                    mesh: ringMesh,
                    spawnTime: currentTime,
                    lifetime: 1200 + energy * 1300, // Lifetime proportional to energy
                    maxRadius: maxRingRadius * (0.25 + energy * 0.75),
                    initialThickness: (1.5 + energy * 15 + (audioData.beat ? 4.0 : 0)) * Math.max(0.1, settings.brightCap) // Thickness reactive
                });
                scene.add(ringMesh);
            }
        });

        // Update and remove rings
        for (let i = activeRings.length - 1; i >= 0; i--) {
            const ring = activeRings[i];
            const age = currentTime - ring.spawnTime;

            if (age > ring.lifetime) {
                scene.remove(ring.mesh);
                if (ring.mesh.material) (ring.mesh.material as THREE.Material).dispose();
                // ringGeometry is shared, so don't dispose here
                activeRings.splice(i, 1);
                continue;
            }

            const lifeProgress = age / ring.lifetime;
            const currentRadius = lifeProgress * ring.maxRadius;
            if (currentRadius < 0.5) continue; // Don't draw if too small
            
            // The ring geometry is unit radius, so scale by currentRadius for size, and initialThickness for visual thickness
            ring.mesh.scale.set(currentRadius, currentRadius, 1);
            // Note: RingGeometry's visual thickness is controlled by innerRadius vs outerRadius.
            // We can't easily change thickness of an existing RingGeometry dynamically without new geometry.
            // The 'initialThickness' here is more of a conceptual value that influences the initial color/opacity.

            // Opacity fades out over life, boosted by RMS and brightCap
            const opacityFade = Math.sin(Math.PI * (1.0 - lifeProgress)); // Sinusoidal fade for smoother appearance
            const alpha = opacityFade * (0.4 + audioData.rms * 0.6) * settings.brightCap * 1.3;
            (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, alpha));
        }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if ((webGLAssets as any).activeRings) {
          (webGLAssets as any).activeRings.forEach((ring: any) => {
            if ((webGLAssets as any).scene) (webGLAssets as any).scene.remove(ring.mesh);
            if (ring.mesh.material) (ring.mesh.material as THREE.Material).dispose();
          });
          (webGLAssets as any).activeRings = [];
        }
        if ((webGLAssets as any).ringGeometry) (webGLAssets as any).ringGeometry.dispose();
      }
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins', // SBNF Light Lavender on Deep Purple
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;

        const GRID_SIZE_X = 16; // Define GRID_SIZE_X
        const GRID_SIZE_Y = Math.floor(GRID_SIZE_X * (canvas.height / canvas.width)); // Define GRID_SIZE_Y
        const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

        const cellGeom = new THREE.PlaneGeometry(1, 1); // Unit plane
        const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: false }); // Will use instanceColor
        const instancedMesh = new THREE.InstancedMesh(cellGeom, cellMaterial, totalCells);
        scene.add(instancedMesh);

        const cellWidth = canvas.width / GRID_SIZE_X;
        const cellHeight = canvas.height / GRID_SIZE_Y;
        const dummy = new THREE.Object3D();
        const initialColor = new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`); // Start with SBNF Deep Purple
        const cellStates: { currentColor: THREE.Color, targetColor: THREE.Color, lastUpdateTime: number, currentScale: number }[] = [];

        for (let j_idx = 0; j_idx < GRID_SIZE_Y; j_idx++) { // Use j_idx for clarity
            for (let i_idx = 0; i_idx < GRID_SIZE_X; i_idx++) { // Use i_idx for clarity
                const index = j_idx * GRID_SIZE_X + i_idx;
                dummy.position.set(
                    (i_idx - GRID_SIZE_X / 2 + 0.5) * cellWidth,
                    (j_idx - GRID_SIZE_Y / 2 + 0.5) * cellHeight,
                    0
                );
                dummy.scale.set(cellWidth * 0.8, cellHeight * 0.8, 1); // Scale down slightly for gaps
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
                instancedMesh.setColorAt(index, initialColor);
                cellStates.push({ currentColor: new THREE.Color().copy(initialColor), targetColor: new THREE.Color().copy(initialColor), lastUpdateTime: 0, currentScale: 0.8 });
            }
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

        return {
            scene, camera, instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellWidth, cellHeight, cellStates,
            dummy: new THREE.Object3D(), // New dummy for updates
            tempColor: new THREE.Color(),
            lastFrameTime: performance.now(),
            bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // SBNF Black for background
        } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, GRID_SIZE_X: number, GRID_SIZE_Y: number, totalCells: number, cellWidth: number, cellHeight: number, cellStates: any[], dummy: THREE.Object3D, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.cellStates || !webGLAssets.dummy || !webGLAssets.tempColor || !webGLAssets.bgColor || !webGLAssets.lastFrameTime) return;
        const { instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellWidth, cellHeight, cellStates, dummy, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        // const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // Not used directly in this version
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearColor(bgColor.getHex(), 1); // Solid black background
        renderer.clear();

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;
        const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.deepPurple];

        for (let j_idx = 0; j_idx < GRID_SIZE_Y; j_idx++) {
            for (let i_idx = 0; i_idx < GRID_SIZE_X; i_idx++) {
                const index = j_idx * GRID_SIZE_X + i_idx;
                // Map cell index to spectrum - spread spectrum across the grid
                const spectrumIndex = Math.floor((index / totalCells) * spectrumLength) % spectrumLength; 
                const energy = spectrum[spectrumIndex] / 255; // Normalize energy 0-1
                const cellState = cellStates[index];

                // Color calculation
                const beatFactor = audioData.beat ? 1.3 : 1.0; // Emphasize color on beat
                const targetLightness = 0.35 + energy * 0.4 * beatFactor * settings.brightCap; // Scale with brightCap
                const targetSaturation = 0.75 + energy * 0.25;

                // Cycle through SBNF hues, influenced by energy and time
                const baseHue = sbnfHues[(i_idx + j_idx + Math.floor(currentTime / 1500)) % sbnfHues.length];
                const hue = (baseHue + energy * 50 + (audioData.beat ? 20 : 0)) % 360;

                const [r,g,bVal] = hslToRgb(hue, Math.min(100, targetSaturation*100), Math.min(100, targetLightness*100));
                cellState.targetColor.setRGB(r,g,bVal);

                // Smoothly interpolate color
                cellState.currentColor.lerp(cellState.targetColor, 0.2); // Faster lerp for more responsiveness
                instancedMesh.setColorAt(index, cellState.currentColor);

                // Scale calculation
                const baseScaleFactor = 0.8; // Base scale for gaps
                const scalePulse = 1.0 + energy * 0.15 * beatFactor * audioData.rms; // Pulse with energy and beat
                const targetScale = baseScaleFactor * scalePulse;
                cellState.currentScale = cellState.currentScale * 0.9 + targetScale * 0.1; // Smooth scale change

                // Update instance matrix for scale (position is static after init)
                instancedMesh.getMatrixAt(index, dummy.matrix); // Get current matrix
                const currentPosition = new THREE.Vector3().setFromMatrixPosition(dummy.matrix);
                dummy.scale.set(cellWidth * cellState.currentScale, cellHeight * cellState.currentScale, 1);
                dummy.position.copy(currentPosition); // Keep original position
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
            }
        }
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        instancedMesh.instanceMatrix.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets && (webGLAssets as any).instancedMesh) {
            if ((webGLAssets as any).instancedMesh.geometry) (webGLAssets as any).instancedMesh.geometry.dispose();
            if ((webGLAssets as any).instancedMesh.material) ((webGLAssets as any).instancedMesh.material as THREE.Material).dispose();
            if ((webGLAssets as any).scene) (webGLAssets as any).scene.remove((webGLAssets as any).instancedMesh);
        }
    },
  },
   {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins', // SBNF DeepPurple/OrangeYellow
    dataAiHint: 'audio spectrum analysis',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const numBars = Math.floor(settings.fftSize / 2); // Typically spectrum length
      const barWidth = canvas.width / numBars;

      const barGeometry = new THREE.PlaneGeometry(barWidth * 0.9, 1); // unit height, scaled later
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: false }); // Will use instanceColor

      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      const dummy = new THREE.Object3D();
      const initialColor = new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 10%)`); // Very dim initial state

      for (let i = 0; i < numBars; i++) {
        dummy.position.set(
          (i - numBars / 2 + 0.5) * barWidth,
          -canvas.height / 2 + 0.5, // Position at bottom edge, height 1
          0
        );
        dummy.scale.set(1, 1, 1); // Initial height of 1, scaled later
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, initialColor);
      }
      scene.add(instancedMesh);

      return {
        scene, camera, instancedMesh, numBars, barWidth,
        dummy: new THREE.Object3D(), // New dummy for updates
        color: new THREE.Color(),   // Reusable color object
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`),
      } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, numBars: number, barWidth: number, dummy: THREE.Object3D, color: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.dummy || !webGLAssets.color || !webGLAssets.bgColor) return;
      const { instancedMesh, numBars, barWidth, dummy, color, bgColor } = webGLAssets as any;

      renderer.setClearColor(bgColor.getHex(), 1); // Solid SBNF Deep Purple background
      renderer.clear();

      const spectrum = audioData.spectrum;
      if (spectrum.length !== numBars) {
        console.warn(`[Spectrum Bars] Spectrum length (${spectrum.length}) mismatch with numBars (${numBars}). This can happen if fftSize changes. Scene might need re-init.`);
        // A more robust solution would re-initialize the instancedMesh if numBars changes.
        // For now, we'll try to draw with what we have or clamp.
      }
      
      const effectiveBrightCap = Math.max(0.05, settings.brightCap); // Ensure some visibility even if brightCap is 0
      const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      // Check for effective silence to draw minimal bars
      const spectrumSumForSilenceCheck = spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (numBars * 0.5); // Threshold: avg spectrum value < 0.5

      for (let i = 0; i < numBars; i++) {
        if (i >= spectrum.length) continue; // Prevent out-of-bounds if spectrum is shorter

        const normalizedValue = isAudioSilent ? 0.005 : (spectrum[i] || 0) / 255; // Ensure a tiny bar even if silent
        const barHeightBase = normalizedValue * canvasHeight * effectiveBrightCap * 1.3; // Adjusted multiplier
        // Add beat reactivity to height
        const barHeight = Math.max(1, barHeightBase * (0.4 + audioData.rms * 0.6 + (audioData.beat ? 0.25 : 0)));

        // Update scale and position
        dummy.scale.set(1, barHeight, 1);
        dummy.position.set(
          (i - numBars / 2 + 0.5) * barWidth, // X position
          barHeight / 2 - canvasHeight / 2, // Y position (bottom aligned, growing up)
          0
        );
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        // Color calculation
        const hueIndex = Math.floor((i / numBars) * sbnfHues.length);
        const baseHue = sbnfHues[hueIndex % sbnfHues.length];
        // Color reacts to normalized value, beat, and time
        const hue = (baseHue + normalizedValue * 30 + (audioData.beat ? 20 : 0) + performance.now() / 200) % 360;
        const saturation = 85 + normalizedValue * 15;
        const lightness = 40 + normalizedValue * 35 + (audioData.beat ? 10 : 0); // Beat makes bars brighter
        const [r,g,bVal] = hslToRgb(hue, Math.min(100, saturation), Math.min(85, lightness)); // Cap lightness
        color.setRGB(r, g, bVal);
        instancedMesh.setColorAt(i, color);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets && (webGLAssets as any).instancedMesh) {
        if ((webGLAssets as any).instancedMesh.geometry) (webGLAssets as any).instancedMesh.geometry.dispose();
        if ((webGLAssets as any).instancedMesh.material) ((webGLAssets as any).instancedMesh.material as THREE.Material).dispose();
        if ((webGLAssets as any).scene) (webGLAssets as any).scene.remove((webGLAssets as any).instancedMesh);
      }
    },
  },
   {
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins', // SBNF Orange-Red on Black
    dataAiHint: 'abstract explosion particles',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 300; // Start camera further back

      const PARTICLE_COUNT = 5000; // Default particle count
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); // x, y, z velocity
      const lifetimes = new Float32Array(PARTICLE_COUNT); // lifetime of each particle

      // Initialize particles (off-screen or at origin, "dead")
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes[i] = 0; // Start dead
        positions[i * 3] = 0; // Initial position at origin
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        // Velocities and colors will be set when spawned
        velocities[i * 3] = 0; velocities[i * 3 + 1] = 0; velocities[i * 3 + 2] = 0;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 3, // Base particle size
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending, // Good for glowing particles
        depthWrite: false, // Important for blending
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      return {
        scene, camera, particles, material, geometry,
        positions, colors, velocities, lifetimes, // Store attribute arrays
        PARTICLE_COUNT,
        lastBeatTime: 0, // Track last beat to control burst frequency
        lastAmbientSpawnTime: 0, // Track last ambient spawn
        tempColor: new THREE.Color(), // Reusable color object
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // SBNF Black
      } as WebGLSceneAssets & { particles: THREE.Points, material: THREE.PointsMaterial, geometry: THREE.BufferGeometry, positions: Float32Array, colors: Float32Array, velocities: Float32Array, lifetimes: Float32Array, PARTICLE_COUNT: number, lastBeatTime: number, lastAmbientSpawnTime: number, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.bgColor || !webGLAssets.lastFrameTime) return;
      const { particles, material, geometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor } = webGLAssets as any;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // deltaTime in seconds
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearColor(bgColor.getHex(), 0.15); // SBNF Black with low alpha for motion trails
      renderer.clear();

      const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
      const sbnfHuesAmbient = [SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];
      let spawnedThisFrame = 0;

      // Beat-triggered burst
      const beatCooldown = 100; // ms, minimum time between bursts
      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown) && spawnedThisFrame < PARTICLE_COUNT * 0.3) {
        webGLAssets.lastBeatTime = currentTime;
        let burstParticlesSpawned = 0;
        const maxBurstParticlesThisBeat = Math.floor(PARTICLE_COUNT * (0.1 + audioData.bassEnergy * 0.3));

        for (let i = 0; i < PARTICLE_COUNT && burstParticlesSpawned < maxBurstParticlesThisBeat; i++) {
          if (lifetimes[i] <= 0) { // Find a "dead" particle to reuse
            const pIdx = i * 3;
            positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0; // Start at center
            // Spherical distribution for velocities
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1); // More uniform spherical distribution
            const speed = 100 + Math.random() * 200 + audioData.bassEnergy * 300 + audioData.rms * 150;
            velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta);
            velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
            velocities[pIdx + 2] = speed * Math.cos(phi);

            // Color from SBNF burst palette
            const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
            const [r, g, bVal] = hslToRgb(hue, 100, 60 + Math.random() * 15); // Bright, saturated colors
            tempColor.setRGB(r, g, bVal);
            colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;

            lifetimes[i] = 1.0 + Math.random() * 1.5; // Lifetime in seconds
            burstParticlesSpawned++;
            spawnedThisFrame++;
          }
        }
      }

      // Ambient particle spawning
      const ambientSpawnRate = 30 + audioData.rms * 150; // Particles per second
      const ambientSpawnInterval = 1000 / Math.max(1, ambientSpawnRate); // Interval in ms
      if (currentTime - webGLAssets.lastAmbientSpawnTime > ambientSpawnInterval && spawnedThisFrame < PARTICLE_COUNT * 0.05) { // Spawn a few ambient particles
        webGLAssets.lastAmbientSpawnTime = currentTime;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          if (lifetimes[i] <= 0) { // Find a "dead" particle
            const pIdx = i * 3;
            positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1.0);
            const speed = 20 + Math.random() * 50 + audioData.midEnergy * 80; // Slower ambient particles
            velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta);
            velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
            velocities[pIdx + 2] = speed * Math.cos(phi);

            const hue = sbnfHuesAmbient[Math.floor(Math.random() * sbnfHuesAmbient.length)];
            const [r, g, bVal] = hslToRgb(hue, 80 + Math.random() * 20, 50 + Math.random() * 20); // More subdued ambient colors
            tempColor.setRGB(r, g, bVal);
            colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;

            lifetimes[i] = 1.5 + Math.random() * 2.0; // Slightly longer ambient lifetime
            spawnedThisFrame++;
            break; // Spawn one ambient particle per eligible interval
          }
        }
      }

      // Update particles
      const dragFactor = 0.97; // Simulate air resistance
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (lifetimes[i] > 0) {
          const pIdx = i * 3;
          lifetimes[i] -= deltaTime;
          if (lifetimes[i] <= 0) {
            // Particle "dies" - effectively hide it by making it black/transparent
            colors[pIdx + 0] = 0; colors[pIdx + 1] = 0; colors[pIdx + 2] = 0; // Could also set alpha if material supports it
            velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0;
            continue;
          }

          // Apply drag
          velocities[pIdx] *= dragFactor;
          velocities[pIdx + 1] *= dragFactor;
          velocities[pIdx + 2] *= dragFactor;

          // Update position
          positions[pIdx] += velocities[pIdx] * deltaTime;
          positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
          positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

          // Fade color over lifetime (simple darkening)
          const lifeRatio = Math.max(0, lifetimes[i] / (1.0 + Math.random() * 1.5)); // Original lifetime was 1.0 + rand*1.5 for burst
          colors[pIdx + 0] *= lifeRatio * 0.98 + 0.02; // Smooth fade to dark
          colors[pIdx + 1] *= lifeRatio * 0.98 + 0.02;
          colors[pIdx + 2] *= lifeRatio * 0.98 + 0.02;
        }
      }

      if(geometry.attributes.position) geometry.attributes.position.needsUpdate = true;
      if(geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
      // Material properties react to global settings and audio
      material.size = (2.0 + audioData.rms * 5.0) * Math.max(0.1, settings.brightCap);
      material.opacity = Math.max(0.1, settings.brightCap * (0.5 + audioData.rms * 0.5));

    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if ((webGLAssets as any).geometry) (webGLAssets as any).geometry.dispose();
            if ((webGLAssets as any).material) (webGLAssets as any).material.dispose();
            // Particles are part of the scene, scene gets cleared
        }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel&font=poppins', // DeepPurple/OrangeRed
    dataAiHint: 'geometric tunnel flight tron',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000); // Increased far plane
      camera.position.z = 50; // Start camera a bit inside the tunnel

      const numSegments = 20;
      const segmentDepth = 100; // Depth of each segment
      const segmentRadius = 100; // Radius of the tunnel

      // Use TorusGeometry for a Tron-like ring segment
      const segmentGeometry = new THREE.TorusGeometry(segmentRadius, 3, 16, 32); // radius, tube, radialSegments, tubularSegments
      const segments: THREE.Mesh[] = [];

      for (let i = 0; i < numSegments; i++) {
        // Material with wireframe for Tron style
        const material = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.7 });
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * segmentDepth; // Spread segments along Z axis
        segment.rotation.x = Math.PI / 2; // Rotate rings to form a tunnel
        scene.add(segment);
        segments.push(segment);
      }

      return {
        scene, camera, segments, numSegments, segmentDepth,
        segmentSpeed: 150, // Base speed of tunnel movement
        cameraBaseFov: 75,
        tempColor: new THREE.Color(),
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
      } as WebGLSceneAssets & { segments: THREE.Mesh[], numSegments: number, segmentDepth: number, segmentSpeed: number, cameraBaseFov: number, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.segments || !(camera instanceof THREE.PerspectiveCamera) || !webGLAssets.cameraBaseFov || !webGLAssets.tempColor || !webGLAssets.lastFrameTime || !webGLAssets.bgColor) return;
        const { segments, segmentDepth, numSegments, segmentSpeed, cameraBaseFov, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // deltaTime in seconds
        webGLAssets.lastFrameTime = currentTime;
    
        renderer.setClearColor(bgColor.getHex(), 1); // Solid black background for Tron
        renderer.clear();
    
        // Update segments
        segments.forEach((segment: THREE.Mesh, i: number) => {
            // Move segment towards the camera
            segment.position.z += segmentSpeed * (1 + audioData.rms * 1.5 + (audioData.beat ? 0.5 : 0)) * deltaTime;
    
            // Recycle segments that have passed the camera
            if (segment.position.z > camera.position.z + segmentDepth / 2) { // Adjust condition slightly
              segment.position.z -= numSegments * segmentDepth;
            }
    
            // Color cycling and audio reactivity for Tron aesthetic
            const hueOptions = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.lightLavender];
            const baseHue = hueOptions[(i + Math.floor(currentTime * 0.0003)) % hueOptions.length]; // Slow color shift
            const audioInfluence = audioData.rms * 60 + (audioData.spectrum[i % audioData.spectrum.length] / 255) * 40;
            const targetHue = (baseHue + audioInfluence + (audioData.beat ? 30 : 0)) % 360;
            
            const lightness = 0.3 + audioData.rms * 0.3 + (audioData.beat ? 0.25 : 0) + settings.brightCap * 0.15; // Modulate lightness
            const [r, g, bVal] = hslToRgb(targetHue, 90 + Math.random()*10, Math.min(0.8, lightness) * 100); // Ensure bright but not white
            tempColor.setRGB(r, g, bVal);
    
            if (segment.material instanceof THREE.MeshBasicMaterial) {
                segment.material.color.lerp(tempColor, 0.1); // Smooth color transition
                segment.material.opacity = Math.min(0.8, 0.5 + audioData.rms * 0.3 + settings.brightCap * 0.2);
            }
    
            // Rotation effects
            segment.rotation.z += (audioData.trebleEnergy * 0.025 + 0.001 + audioData.bpm * 0.00002) * (i % 2 === 0 ? 1.2 : -1.4) * deltaTime * 60; // Vary rotation per segment
            segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0006 + i * 0.35) * audioData.midEnergy * 0.6; // Wobble effect
        });
    
        // Camera FOV effect for speed/warping
        camera.fov = cameraBaseFov - audioData.rms * 35 * settings.gamma + (audioData.beat ? 8 : 0) ; // Zoom in/out with RMS/beat
        camera.fov = Math.max(40, Math.min(100, camera.fov));
        camera.updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets && (webGLAssets as any).segments && (webGLAssets as any).scene) {
        (webGLAssets as any).segments.forEach((segment: THREE.Mesh) => {
          if (segment.geometry) segment.geometry.dispose();
          if (segment.material) (segment.material as THREE.Material).dispose();
          if ((webGLAssets as any).scene) (webGLAssets as any).scene.remove(segment);
        });
        (webGLAssets as any).segments = [];
      }
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    rendererType: 'webgl', // Changed to WebGL
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins', // SBNF Cream on Black
    dataAiHint: 'strobe light flash',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      // Orthographic camera for a full-screen effect
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      
      // A plane that covers the entire screen
      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeMaterial = new THREE.MeshBasicMaterial({ 
        color: new THREE.Color(SBNF_HUES_SCENE.black), // Start with black background
        transparent: true, 
        opacity: 1 // Start opaque black
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(planeMesh);

      return {
        scene,
        camera,
        planeMesh, 
        planeMaterial, 
        tempColor: new THREE.Color(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // Store for off-state
        lastFrameTime: performance.now(),
      } as WebGLSceneAssets & { planeMesh: THREE.Mesh, planeMaterial: THREE.MeshBasicMaterial, tempColor: THREE.Color, bgColor: THREE.Color, lastFrameTime: number };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.planeMesh || !webGLAssets.planeMaterial || !webGLAssets.tempColor || !webGLAssets.bgColor || !webGLAssets.lastFrameTime) return;
      const { planeMesh, planeMaterial, tempColor, bgColor } = webGLAssets as any;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // deltaTime in seconds
      webGLAssets.lastFrameTime = currentTime;

      // Strobe on beat if brightCap allows
      if (audioData.beat && settings.brightCap > 0.01) {
        // Flash with a bright color from SBNF palette
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
        const lightness = 80 + Math.random() * 15; // Very bright
        const [r,g,bVal] = hslToRgb(hue, 100, lightness);
        tempColor.setRGB(r,g,bVal);
        
        planeMaterial.color.copy(tempColor);
        planeMaterial.opacity = Math.min(1, settings.brightCap * 1.2); // Use brightCap, allow slight overexposure
      } else {
        // Fade out the flash quickly or stay black
        planeMaterial.opacity = Math.max(0, planeMaterial.opacity - deltaTime * 10.0); // Faster fade out
        if (planeMaterial.opacity <= 0.01) {
          planeMaterial.color.copy(bgColor); // Reset to background color when fully faded
          planeMaterial.opacity = 1; // Ensure it's opaque black for the "off" state
        }
      }
      // No need to call renderer.clear() as the plane covers the screen
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if ((webGLAssets as any).planeMesh && (webGLAssets as any).planeMesh.geometry) (webGLAssets as any).planeMesh.geometry.dispose();
        if ((webGLAssets as any).planeMaterial) (webGLAssets as any).planeMaterial.dispose();
        // Mesh is part of the scene, which gets cleared or replaced
      }
    }
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale&font=poppins', // SBNF Orange-Yellow on Deep Purple
    dataAiHint: 'cosmic explosion stars fireworks',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 400;

      const PARTICLE_COUNT = 3500; // Reduced from 5000 to manage performance
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT); // Store lifetime, > 0 means active

      const sbnfHuesInitial = [SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];
      const tempColor = new THREE.Color();

      for (let i = 0; i < PARTICLE_COUNT; i++) {
          lifetimes[i] = 0; // All particles start "dead"
          const pIdx = i * 3;
          // Initialize off-screen to avoid initial flash of uncolored particles at origin
          positions[pIdx] = 10000; positions[pIdx + 1] = 10000; positions[pIdx + 2] = 10000;
          
          // Assign an initial base color (will be faint due to lifetime 0)
          const hue = sbnfHuesInitial[i % sbnfHuesInitial.length];
          const [r,g,bVal] = hslToRgb(hue, 70 + Math.random() * 30, 30 + Math.random() * 20); // Dimmer initial colors
          tempColor.setRGB(r,g,bVal);
          colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 1.8, // Reduced base size
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      const webGLAssets = {
        scene, camera, particles, material, geometry,
        positions, colors, velocities, lifetimes, // Buffers
        PARTICLE_COUNT,
        lastBeatTime: 0, // Initialize to ensure first beat triggers
        tempColor: new THREE.Color(),
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        rotationSpeed: new THREE.Vector3(0.01, 0.012, 0.005), // Slower, more controlled rotation
      };
      console.log('[Particle Finale] initWebGL completed. PARTICLE_COUNT:', PARTICLE_COUNT);
      return webGLAssets as WebGLSceneAssets & { particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; PARTICLE_COUNT: number; lastBeatTime: number; tempColor: THREE.Color; lastFrameTime: number; bgColor: THREE.Color; rotationSpeed: THREE.Vector3; };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.lastFrameTime) {
          console.error('[Particle Finale] Missing critical webGLAssets in drawWebGL');
          return;
        }
        const { particles, material, geometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor, rotationSpeed } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // deltaTime in seconds
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearColor(bgColor.getHex(), 0.1); // Slightly more persistent trails
        renderer.clear();
    
        const beatCooldown = 180; // ms, minimum time between bursts
        const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender];
    
        let particlesSpawnedThisBeat = 0;
        if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            // Spawn a portion of total particles, influenced by audio, capped to avoid overdraw
            let particlesToSpawn = Math.floor(PARTICLE_COUNT * (0.15 + audioData.bassEnergy * 0.25 + audioData.rms * 0.1)); // Adjusted spawn rate
            particlesToSpawn = Math.min(particlesToSpawn, Math.floor(PARTICLE_COUNT * 0.35)); // Cap particles per beat

            console.log(`[Particle Finale] Beat detected! Attempting to spawn ${particlesToSpawn} particles.`);
            let spawnedCount = 0;
            for (let i = 0; i < PARTICLE_COUNT && spawnedCount < particlesToSpawn; i++) {
                if (lifetimes[i] <= 0) { // Find a "dead" particle to reuse
                    const pIdx = i * 3;
                    // Spawn near center with slight randomization
                    positions[pIdx] = (Math.random() - 0.5) * 5; 
                    positions[pIdx + 1] = (Math.random() - 0.5) * 5;
                    positions[pIdx + 2] = (Math.random() - 0.5) * 5;
    
                    // Spherical velocity distribution
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1.0); // Corrected for uniform spherical distribution
                    const speed = 180 + Math.random() * 220 + audioData.bassEnergy * 280 + audioData.rms * 140; // Speed influenced by audio
                    velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);
    
                    // Color from SBNF burst palette
                    const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
                    const [r,g,bVal] = hslToRgb(hue, 90 + Math.random() * 10, 50 + Math.random() * 20); // Capped lightness to avoid pure white
                    tempColor.setRGB(r,g,bVal);
                    colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;
    
                    lifetimes[i] = 1.8 + Math.random() * 1.2; // Lifetime in seconds, slightly longer
                    spawnedCount++;
                    particlesSpawnedThisBeat++;
                }
            }
            if (spawnedCount > 0) console.log(`[Particle Finale] Actually spawned ${spawnedCount} particles on beat.`);
        }
    
        // Update active particles
        const dragFactor = 0.975; // Slightly less drag for wider spread
        let liveParticlesCount = 0;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (lifetimes[i] > 0) { 
                liveParticlesCount++;
                const pIdx = i * 3;
                lifetimes[i] -= deltaTime;
                if (lifetimes[i] <= 0) {
                    // Particle "dies" - move it off-screen and reset velocity
                    positions[pIdx] = 10000; // Far off-screen
                    velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0;
                    // Optionally make color black/transparent if material uses alpha
                    colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0;
                    continue;
                }
    
                // Apply drag to velocities
                velocities[pIdx] *= dragFactor; 
                velocities[pIdx + 1] *= dragFactor; 
                velocities[pIdx + 2] *= dragFactor;
    
                // Update positions
                positions[pIdx] += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;
                
                // Fade color over lifetime (simple darkening)
                const lifeRatio = Math.max(0, lifetimes[i] / (1.8 + Math.random() * 1.2)); // Original lifetime was 1.8 + rand*1.2
                const fadeFactor = lifeRatio * 0.97 + 0.03; // Slower fade out
                colors[pIdx] *= fadeFactor; 
                colors[pIdx+1] *= fadeFactor; 
                colors[pIdx+2] *= fadeFactor;
            }
        }
        // if(liveParticlesCount > 0 || particlesSpawnedThisBeat > 0) console.log(`[Particle Finale] Live particles: ${liveParticlesCount}`);
    
        // Mark attributes for update
        if (geometry.attributes.position) geometry.attributes.position.needsUpdate = true;
        if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
    
        // Update material properties based on global settings and audio
        material.size = (1.8 + audioData.rms * 3.5) * Math.max(0.1, settings.brightCap); // Adjusted base size and reactivity
        material.opacity = Math.max(0.1, settings.brightCap * (0.35 + audioData.rms * 0.55)); // Opacity reactivity

        // Rotate the entire particle system slowly
        if (particles && rotationSpeed) {
            particles.rotation.x += rotationSpeed.x * deltaTime * (0.2 + audioData.midEnergy * 0.6);
            particles.rotation.y += rotationSpeed.y * deltaTime * (0.2 + audioData.trebleEnergy * 0.6);
            // particles.rotation.z += rotationSpeed.z * deltaTime;
        }
        // Camera effects (FOV, Z position)
        if(camera && camera instanceof THREE.PerspectiveCamera) { // Type guard
            camera.fov = 75 + audioData.rms * 5; // Much less drastic fov change
            camera.fov = Math.max(70, Math.min(85, camera.fov));
            camera.updateProjectionMatrix();
            camera.position.z = 400 - audioData.rms * 50; // Much less pullback
        }
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if ((webGLAssets as any).geometry) (webGLAssets as any).geometry.dispose();
            if ((webGLAssets as any).material) (webGLAssets as any).material.dispose();
            // particles are added to scene, scene will be cleared.
        }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";

