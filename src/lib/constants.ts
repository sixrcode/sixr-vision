
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

// SBNF "Cosmic Grapevines" Themed Defaults
export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1.0,
  enableAgc: true,
  gamma: 1.0,
  dither: 0.0,
  brightCap: 1.0,
  logoOpacity: 0.25,
  showWebcam: false, // Default to off, user must enable
  mirrorWebcam: true, // Mirror by default when webcam is on
  currentSceneId: 'radial_burst', // Default to a more active scene
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse', // Default to pulse
    speed: 1,
    color: '#FF441A', // SBNF Orange-Red
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500,
  sceneTransitionActive: true,
  monitorAudio: false,
  selectedAudioInputDeviceId: undefined,
  enableAiOverlay: false, // Default AI Overlay to off initially
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent", // SBNF-themed default
  enablePeriodicAiOverlay: false, // Periodic updates off by default
  aiOverlayRegenerationInterval: 45, // Default interval for periodic updates
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins', // DeepPurple/LightPeach
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const webGLAssets: Partial<WebGLSceneAssets> & { planeMesh?: THREE.Mesh, videoTexture?: THREE.VideoTexture, shaderMaterial?: THREE.ShaderMaterial, bgColor?: THREE.Color } = { scene, camera, bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`) };

      if (webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0) {
        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.colorSpace = THREE.SRGBColorSpace;
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
            float luminance = dot(webcamColor.rgb, vec3(0.299, 0.587, 0.114));
            
            // Stronger silhouette using a step function
            vec3 silhouetteColor = dynamicColor * (1.0 - step(0.45, luminance)); 
            
            // Mix original color lightly with silhouette for subtle detail
            vec3 finalColor = mix(webcamColor.rgb * 0.3, silhouetteColor, 0.85);

            gl_FragColor = vec4(finalColor, webcamColor.a * opacityFactor);
          }
        `;

        const shaderMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            webcamTexture: { value: videoTexture },
            dynamicColor: { value: new THREE.Color(`hsl(${SBNF_HUES_SCENE.orangeRed}, 100%, 55%)`) },
            opacityFactor: { value: 1.0 },
            mirrorX: { value: settings.mirrorWebcam },
          },
          transparent: true,
          depthWrite: false,
        });
        webGLAssets.shaderMaterial = shaderMaterial;

        const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        webGLAssets.planeMesh = planeMesh;
      }
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      if (!renderer || !webGLAssets) return;
      const { shaderMaterial, videoTexture, planeMesh, bgColor } = webGLAssets;

      if (planeMesh && shaderMaterial && videoTexture && settings.showWebcam && webcamElement && webcamElement.readyState >= webcamElement.HAVE_ENOUGH_DATA) {
        videoTexture.needsUpdate = true;
        shaderMaterial.uniforms.mirrorX.value = settings.mirrorWebcam;
        
        const overallOpacity = Math.max(0.1, settings.brightCap * (0.7 + audioData.rms * 0.3));
        shaderMaterial.uniforms.opacityFactor.value = overallOpacity;

        const hueTimeShift = (performance.now() / 12000) * 360; 
        const baseHue = (SBNF_HUES_SCENE.lightLavender + audioData.midEnergy * 50 + hueTimeShift) % 360;
        const saturation = 60 + audioData.trebleEnergy * 40;
        const lightness = 45 + audioData.bassEnergy * 25 + (audioData.beat ? 15 : 0);
        const [r, g, b] = hslToRgb(baseHue, saturation, lightness);
        shaderMaterial.uniforms.dynamicColor.value.setRGB(r, g, b);
        
        // Fit video to cover canvas, potentially cropping
        const canvasAspect = canvasWidth / canvasHeight;
        const videoAspect = webcamElement.videoWidth / webcamElement.videoHeight;
        if (planeMesh.scale.x !== canvasWidth || planeMesh.scale.y !== canvasHeight) { // Rescale plane if canvas size changes
            planeMesh.geometry.dispose();
            planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
        }

        if (canvasAspect > videoAspect) { // Canvas is wider than video
            videoTexture.repeat.x = videoAspect / canvasAspect;
            videoTexture.repeat.y = 1;
            videoTexture.offset.x = (1 - videoTexture.repeat.x) / 2;
            videoTexture.offset.y = 0;
        } else { // Canvas is taller than video (or same aspect)
            videoTexture.repeat.x = 1;
            videoTexture.repeat.y = canvasAspect / videoAspect;
            videoTexture.offset.x = 0;
            videoTexture.offset.y = (1 - videoTexture.repeat.y) / 2;
        }

      } else {
        renderer.setClearColor(bgColor || new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`).getHex(), 1);
        renderer.clear();
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.videoTexture) webGLAssets.videoTexture.dispose();
        if (webGLAssets.planeMesh && webGLAssets.planeMesh.geometry) webGLAssets.planeMesh.geometry.dispose();
        if (webGLAssets.shaderMaterial) webGLAssets.shaderMaterial.dispose();
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

      const circleGeom = new THREE.CircleGeometry(0.5, 32); 
      const squareGeom = new THREE.PlaneGeometry(1, 1);
      const triangleShape = new THREE.Shape();
      triangleShape.moveTo(0, 0.5); 
      triangleShape.lineTo(0.5 * Math.cos(Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(Math.PI / 6 + Math.PI / 2)); 
      triangleShape.lineTo(0.5 * Math.cos(5 * Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(5 * Math.PI / 6 + Math.PI / 2)); 
      triangleShape.closePath();
      const triangleGeom = new THREE.ShapeGeometry(triangleShape);

      return {
        scene,
        camera,
        geometries: [circleGeom, squareGeom, triangleGeom],
        activeShapes: [],
        lastSpawnTime: 0,
        spawnInterval: 100, 
        shapeBaseLifetime: 2500,
        lastFrameTime: performance.now(),
        tempColor: new THREE.Color(),
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`),
      } as WebGLSceneAssets & { geometries: THREE.BufferGeometry[], activeShapes: any[], lastSpawnTime: number, spawnInterval: number, shapeBaseLifetime: number, lastFrameTime: number, tempColor: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.geometries || !webGLAssets.activeShapes || !webGLAssets.bgColor || !webGLAssets.tempColor || !webGLAssets.lastFrameTime) return;
      const { geometries, activeShapes, shapeBaseLifetime, bgColor, tempColor } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime); // ms
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearColor(bgColor.getHex(), 0.08); 
      renderer.clear();

      const spawnInterval = webGLAssets.spawnInterval / (1 + audioData.rms * 5); 
      const spawnCondition = audioData.beat || (audioData.rms > 0.015 && currentTime - webGLAssets.lastSpawnTime > spawnInterval);

      if (spawnCondition && activeShapes.length < 80) { 
        webGLAssets.lastSpawnTime = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 3 + audioData.bassEnergy * 2 + (audioData.beat ? 2: 0));

        for (let k = 0; k < numToSpawn; k++) {
          const geom = geometries[Math.floor(Math.random() * geometries.length)];
          const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geom, material);

          const sizeBase = (10 + audioData.bassEnergy * 120 + Math.random() * 50);
          const initialScale = sizeBase * Math.max(0.1, settings.brightCap) * (0.25 + audioData.midEnergy * 0.75);
          if (initialScale < 3) continue;

          mesh.position.set(
            (Math.random() - 0.5) * canvasWidth * 0.85,
            (Math.random() - 0.5) * canvasHeight * 0.85,
            0
          );
          mesh.scale.set(initialScale * 0.05, initialScale * 0.05, 1);

          const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.tronBlue];
          const baseObjectHue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
          const hue = (baseObjectHue + (audioData.spectrum[k*5 % audioData.spectrum.length] / 255) * 30 + (audioData.beat ? 15:0) + performance.now()/300) % 360;

          const [r,g,bVal] = hslToRgb(hue, 85 + Math.random()*15, 55 + Math.random()*20);
          material.color.setRGB(r,g,bVal);

          const lifetime = shapeBaseLifetime * (0.6 + Math.random() * 0.8);
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

      for (let i = activeShapes.length - 1; i >= 0; i--) {
        const shape = activeShapes[i];
        const age = currentTime - shape.spawnTime;

        if (age > shape.lifetime) {
          scene.remove(shape.mesh);
          if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose();
          if (shape.mesh.geometry) (shape.mesh.geometry as THREE.BufferGeometry).dispose(); // Dispose individual mesh geometry if it's not shared
          activeShapes.splice(i, 1);
          continue;
        }

        const lifeProgress = age / shape.lifetime;
        const growInPhase = Math.min(1.0, age / shape.growInDuration);

        let currentScaleFactor = growInPhase;
        if (age > shape.growInDuration) {
          currentScaleFactor = 1 + Math.sin((age - shape.growInDuration) * 0.003 * (1 + audioData.midEnergy * 2)) * 0.12;
        }
        const finalScale = shape.initialScale * currentScaleFactor;
        shape.mesh.scale.set(finalScale, finalScale, finalScale);

        const targetOpacity = (0.25 + audioData.trebleEnergy * 0.5 + audioData.rms * 0.4) * settings.brightCap * 1.2;
        (shape.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, (1.0 - lifeProgress) * targetOpacity * growInPhase));

        shape.mesh.rotation.z += shape.rotationSpeed * deltaTime * 0.06; // Convert ms deltaTime to ~seconds based factor
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.activeShapes) {
          webGLAssets.activeShapes.forEach((shape: any) => {
            if (webGLAssets.scene) webGLAssets.scene.remove(shape.mesh);
            if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose();
            if (shape.mesh.geometry) (shape.mesh.geometry as THREE.BufferGeometry).dispose();
          });
          webGLAssets.activeShapes = [];
        }
        // Shared geometries are disposed of here
        if (webGLAssets.geometries) {
          webGLAssets.geometries.forEach((geom: THREE.BufferGeometry) => geom.dispose());
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

        const ringGeometry = new THREE.RingGeometry(0.98, 1, 64); 
        return {
            scene, camera,
            activeRings: [],
            ringGeometry,
            lastSpawnTimes: [0,0,0], 
            tempColor: new THREE.Color(),
            bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`),
        } as WebGLSceneAssets & { activeRings: any[], ringGeometry: THREE.BufferGeometry, lastSpawnTimes: number[], tempColor: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.ringGeometry || !webGLAssets.activeRings || !webGLAssets.lastSpawnTimes || !webGLAssets.tempColor || !webGLAssets.bgColor) return;
        const { ringGeometry, activeRings, lastSpawnTimes, tempColor, bgColor } = webGLAssets;
        const currentTime = performance.now();

        renderer.setClearColor(bgColor.getHex(), 0.12);
        renderer.clear();

        const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
        const baseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
        const spawnIntervals = [160, 130, 110]; 
        const maxRingRadius = Math.min(canvasWidth, canvasHeight) * 0.45; 

        energies.forEach((energy, i) => {
            const effectiveEnergy = Math.max(0.01, energy); 
            if (energy > 0.03 && currentTime - lastSpawnTimes[i] > spawnIntervals[i] / (effectiveEnergy * 5 + 0.1)) {
                lastSpawnTimes[i] = currentTime;

                const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, opacity: 0 });
                const ringMesh = new THREE.Mesh(ringGeometry, material);

                const hue = (baseHues[i] + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 40 + (audioData.beat ? 25 : 0) + performance.now()/400) % 360;
                const [r,g,bVal] = hslToRgb(hue, 90 + energy*10, 60 + energy*20);
                tempColor.setRGB(r,g,bVal);
                material.color.copy(tempColor);

                activeRings.push({
                    mesh: ringMesh,
                    spawnTime: currentTime,
                    lifetime: 1200 + energy * 1300, 
                    maxRadius: maxRingRadius * (0.25 + energy * 0.75),
                    initialThickness: (1.5 + energy * 15 + (audioData.beat ? 4.0 : 0)) * Math.max(0.1, settings.brightCap)
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
                // Ring geometry is shared, so don't dispose here
                activeRings.splice(i, 1);
                continue;
            }

            const lifeProgress = age / ring.lifetime;
            const currentRadius = lifeProgress * ring.maxRadius;
            if (currentRadius < 0.5) continue;
            
            ring.mesh.scale.set(currentRadius, currentRadius, 1);

            const opacityFade = Math.sin(Math.PI * (1.0 - lifeProgress)); 
            const alpha = opacityFade * (0.4 + audioData.rms * 0.6) * settings.brightCap * 1.3;
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
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins', // SBNF Light Lavender on Deep Purple
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;

        const GRID_SIZE_X = 16;
        const GRID_SIZE_Y = Math.floor(GRID_SIZE_X * (canvas.height / canvas.width));
        const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

        const cellGeom = new THREE.PlaneGeometry(1, 1);
        const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: false }); 
        const instancedMesh = new THREE.InstancedMesh(cellGeom, cellMaterial, totalCells);
        scene.add(instancedMesh);

        const cellWidth = canvas.width / GRID_SIZE_X;
        const cellHeight = canvas.height / GRID_SIZE_Y;
        const dummy = new THREE.Object3D();
        const initialColor = new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`);
        const cellStates: { currentColor: THREE.Color, targetColor: THREE.Color, lastUpdateTime: number, currentScale: number }[] = [];

        for (let j = 0; j < GRID_SIZE_Y; j++) { 
            for (let i = 0; i < GRID_SIZE_X; i++) { 
                const index = j * GRID_SIZE_X + i;
                dummy.position.set(
                    (i - GRID_SIZE_X / 2 + 0.5) * cellWidth,
                    (j - GRID_SIZE_Y / 2 + 0.5) * cellHeight,
                    0
                );
                dummy.scale.set(cellWidth * 0.8, cellHeight * 0.8, 1); 
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
            dummy: new THREE.Object3D(), tempColor: new THREE.Color(), lastFrameTime: performance.now(),
            bgColor: new THREE.Color(SBNF_HUES_SCENE.black), 
        } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, GRID_SIZE_X: number, GRID_SIZE_Y: number, totalCells: number, cellWidth: number, cellHeight: number, cellStates: any[], dummy: THREE.Object3D, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets }) => {
        if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.cellStates || !webGLAssets.dummy || !webGLAssets.tempColor || !webGLAssets.bgColor || !webGLAssets.lastFrameTime) return;
        const { instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellWidth, cellHeight, cellStates, dummy, tempColor, bgColor } = webGLAssets;
        const currentTime = performance.now();
        // const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // deltaTime not currently used for complex physics
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearColor(bgColor.getHex(), 1);
        renderer.clear();

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;
        const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.deepPurple];

        for (let j = 0; j < GRID_SIZE_Y; j++) {
            for (let i = 0; i < GRID_SIZE_X; i++) {
                const index = j * GRID_SIZE_X + i;
                const spectrumIndex = Math.floor((index / totalCells) * spectrumLength) % spectrumLength; 
                const energy = spectrum[spectrumIndex] / 255;
                const cellState = cellStates[index];

                const beatFactor = audioData.beat ? 1.3 : 1.0;
                const targetLightness = 0.35 + energy * 0.4 * beatFactor * settings.brightCap; 
                const targetSaturation = 0.75 + energy * 0.25;

                const baseHue = sbnfHues[(i + j + Math.floor(currentTime / 1500)) % sbnfHues.length];
                const hue = (baseHue + energy * 50 + (audioData.beat ? 20 : 0)) % 360;

                const [r,g,bVal] = hslToRgb(hue, Math.min(100, targetSaturation*100), Math.min(100, targetLightness*100));
                cellState.targetColor.setRGB(r,g,bVal);

                cellState.currentColor.lerp(cellState.targetColor, 0.2); 
                instancedMesh.setColorAt(index, cellState.currentColor);

                const baseScaleFactor = 0.8; 
                const scalePulse = 1.0 + energy * 0.15 * beatFactor * audioData.rms;
                const targetScale = baseScaleFactor * scalePulse;
                cellState.currentScale = cellState.currentScale * 0.9 + targetScale * 0.1; 

                instancedMesh.getMatrixAt(index, dummy.matrix); 
                const currentPosition = new THREE.Vector3().setFromMatrixPosition(dummy.matrix);
                dummy.scale.set(cellWidth * cellState.currentScale, cellHeight * cellState.currentScale, 1);
                dummy.position.copy(currentPosition); // Ensure position isn't reset by scale change
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
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins', // DeepPurple/OrangeYellow
    dataAiHint: 'audio spectrum analysis',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const numBars = settings.fftSize / 2;
      const barWidth = canvas.width / numBars;

      const barGeometry = new THREE.PlaneGeometry(barWidth * 0.9, 1); // Width, height (height will be scaled)
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: false }); // Use instance colors

      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      const dummy = new THREE.Object3D();
      const initialColor = new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`); // Dim initial state

      for (let i = 0; i < numBars; i++) {
        dummy.position.set(
          (i - numBars / 2 + 0.5) * barWidth,
          -canvas.height / 2 + 0.5, // Position at bottom edge
          0
        );
        dummy.scale.set(1, 1, 1); // Initial small height
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, initialColor);
      }
      scene.add(instancedMesh);

      return {
        scene, camera, instancedMesh, numBars, barWidth,
        dummy: new THREE.Object3D(), // For matrix updates
        color: new THREE.Color(),   // For color calculations
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`),
      } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, numBars: number, barWidth: number, dummy: THREE.Object3D, color: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.dummy || !webGLAssets.color || !webGLAssets.bgColor) return;
      const { instancedMesh, numBars, barWidth, dummy, color, bgColor } = webGLAssets;

      renderer.setClearColor(bgColor.getHex(), 1); // SBNF Deep Purple
      renderer.clear();

      const spectrum = audioData.spectrum;
      const effectiveBrightCap = Math.max(0.05, settings.brightCap);
      const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      const spectrumSumForSilenceCheck = spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (numBars * 0.5);

      for (let i = 0; i < numBars; i++) {
        const normalizedValue = isAudioSilent ? 0.005 : (spectrum[i] || 0) / 255;
        const barHeightBase = normalizedValue * canvasHeight * effectiveBrightCap * 1.3;
        const barHeight = Math.max(1, barHeightBase * (0.4 + audioData.rms * 0.6 + (audioData.beat ? 0.25 : 0)));

        dummy.scale.set(1, barHeight, 1);
        dummy.position.set(
          (i - numBars / 2 + 0.5) * barWidth,
          barHeight / 2 - canvasHeight / 2, // Position based on bottom edge
          0
        );
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        const hueIndex = Math.floor((i / numBars) * sbnfHues.length);
        const baseHue = sbnfHues[hueIndex % sbnfHues.length];
        const hue = (baseHue + normalizedValue * 30 + (audioData.beat ? 20 : 0) + performance.now() / 200) % 360;
        const saturation = 85 + normalizedValue * 15;
        const lightness = 40 + normalizedValue * 35 + (audioData.beat ? 10 : 0);
        const [r,g,bVal] = hslToRgb(hue, Math.min(100, saturation), Math.min(85, lightness));
        color.setRGB(r, g, bVal);
        instancedMesh.setColorAt(i, color);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
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
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins', // SBNF Orange-Red on Black
    dataAiHint: 'abstract explosion particles',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 300;

      const PARTICLE_COUNT = 5000;
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes[i] = 0; 
        positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0; 
        velocities[i * 3] = 0; velocities[i * 3 + 1] = 0; velocities[i * 3 + 2] = 0;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      return {
        scene, camera, particles, material, geometry,
        positions, colors, velocities, lifetimes,
        PARTICLE_COUNT,
        lastBeatTime: 0,
        lastAmbientSpawnTime: 0,
        tempColor: new THREE.Color(),
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
      } as WebGLSceneAssets & { particles: THREE.Points, material: THREE.PointsMaterial, geometry: THREE.BufferGeometry, positions: Float32Array, colors: Float32Array, velocities: Float32Array, lifetimes: Float32Array, PARTICLE_COUNT: number, lastBeatTime: number, lastAmbientSpawnTime: number, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.bgColor || !webGLAssets.lastFrameTime) return;
      const { particles, material, geometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0;
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearColor(bgColor.getHex(), 0.15); 
      renderer.clear();

      const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
      const sbnfHuesAmbient = [SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];
      let spawnedThisFrame = 0;

      const beatCooldown = 100; 
      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown) && spawnedThisFrame < PARTICLE_COUNT * 0.3) {
        webGLAssets.lastBeatTime = currentTime;
        let burstParticlesSpawned = 0;
        const maxBurstParticlesThisBeat = Math.floor(PARTICLE_COUNT * (0.1 + audioData.bassEnergy * 0.3));

        for (let i = 0; i < PARTICLE_COUNT && burstParticlesSpawned < maxBurstParticlesThisBeat; i++) {
          if (lifetimes[i] <= 0) { 
            const pIdx = i * 3;
            positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 100 + Math.random() * 200 + audioData.bassEnergy * 300 + audioData.rms * 150;
            velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta);
            velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
            velocities[pIdx + 2] = speed * Math.cos(phi);

            const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
            const [r, g, bVal] = hslToRgb(hue, 100, 60 + Math.random() * 15);
            tempColor.setRGB(r, g, bVal);
            colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;

            lifetimes[i] = 1.0 + Math.random() * 1.5;
            burstParticlesSpawned++;
            spawnedThisFrame++;
          }
        }
      }

      const ambientSpawnRate = 30 + audioData.rms * 150;
      const ambientSpawnInterval = 1000 / Math.max(1, ambientSpawnRate);
      if (currentTime - webGLAssets.lastAmbientSpawnTime > ambientSpawnInterval && spawnedThisFrame < PARTICLE_COUNT * 0.05) {
        webGLAssets.lastAmbientSpawnTime = currentTime;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          if (lifetimes[i] <= 0) {
            const pIdx = i * 3;
            positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 20 + Math.random() * 50 + audioData.midEnergy * 80;
            velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta);
            velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
            velocities[pIdx + 2] = speed * Math.cos(phi);

            const hue = sbnfHuesAmbient[Math.floor(Math.random() * sbnfHuesAmbient.length)];
            const [r, g, bVal] = hslToRgb(hue, 80 + Math.random() * 20, 50 + Math.random() * 20);
            tempColor.setRGB(r, g, bVal);
            colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;

            lifetimes[i] = 1.5 + Math.random() * 2.0;
            spawnedThisFrame++;
            break;
          }
        }
      }

      const dragFactor = 0.97;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (lifetimes[i] > 0) {
          const pIdx = i * 3;
          lifetimes[i] -= deltaTime;
          if (lifetimes[i] <= 0) {
            colors[pIdx + 0] = 0; colors[pIdx + 1] = 0; colors[pIdx + 2] = 0; 
            velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0;
            continue;
          }

          velocities[pIdx] *= dragFactor;
          velocities[pIdx + 1] *= dragFactor;
          velocities[pIdx + 2] *= dragFactor;

          positions[pIdx] += velocities[pIdx] * deltaTime;
          positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
          positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

          const lifeRatio = Math.max(0, lifetimes[i] / (1.0 + Math.random() * 1.5));
          colors[pIdx + 0] *= lifeRatio * 0.98 + 0.02; 
          colors[pIdx + 1] *= lifeRatio * 0.98 + 0.02;
          colors[pIdx + 2] *= lifeRatio * 0.98 + 0.02;
        }
      }

      if(geometry.attributes.position) geometry.attributes.position.needsUpdate = true;
      if(geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
      material.size = (2.0 + audioData.rms * 5.0) * Math.max(0.1, settings.brightCap);
      material.opacity = Math.max(0.1, settings.brightCap * (0.5 + audioData.rms * 0.5));

    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.geometry) webGLAssets.geometry.dispose();
            if (webGLAssets.material) webGLAssets.material.dispose();
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
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(SBNF_HUES_SCENE.black, 1); // Use SBNF black

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 50; // Adjusted for better view

      const numSegments = 20;
      const segmentDepth = 100; // How "deep" each segment is, affecting spacing
      const segmentRadius = 100; // Radius of the torus/ring

      const segmentGeometry = new THREE.TorusGeometry(segmentRadius, 3, 16, 32); // Thinner tube, fewer segments for wireframe
      const segments: THREE.Mesh[] = [];

      for (let i = 0; i < numSegments; i++) {
        // Each segment gets its own material for individual color control if needed, but start with shared.
        const material = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.7 });
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * segmentDepth; // Space them out along Z
        segment.rotation.x = Math.PI / 2; // Orient rings correctly
        scene.add(segment);
        segments.push(segment);
      }

      return {
        scene, camera, renderer, segments, numSegments, segmentDepth,
        segmentSpeed: 150, // Base speed of tunnel movement
        cameraBaseFov: 75,
        tempColor: new THREE.Color(),
        lastFrameTime: performance.now(),
      } as WebGLSceneAssets & { segments: THREE.Mesh[], numSegments: number, segmentDepth: number, segmentSpeed: number, cameraBaseFov: number, tempColor: THREE.Color, lastFrameTime: number };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
        if (!webGLAssets || !webGLAssets.segments || !webGLAssets.camera || !webGLAssets.cameraBaseFov || !webGLAssets.tempColor || !webGLAssets.lastFrameTime) return;
        const { segments, segmentDepth, numSegments, segmentSpeed, cameraBaseFov, tempColor } = webGLAssets;
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // seconds
        webGLAssets.lastFrameTime = currentTime;
    
        renderer.clear(); // Clears with the color set in initWebGL
    
        segments.forEach((segment: THREE.Mesh, i: number) => {
            segment.position.z += segmentSpeed * (1 + audioData.rms * 1.5 + (audioData.beat ? 0.5 : 0)) * deltaTime;
    
            // Recycle segments that move past the camera
            if (segment.position.z > camera.position.z + segmentDepth / 2) {
            segment.position.z -= numSegments * segmentDepth;
            }
    
            const hueOptions = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.lightLavender];
            const baseHue = hueOptions[(i + Math.floor(currentTime * 0.0003)) % hueOptions.length];
            const audioInfluence = audioData.rms * 60 + (audioData.spectrum[i % audioData.spectrum.length] / 255) * 40;
            const targetHue = (baseHue + audioInfluence + (audioData.beat ? 30 : 0)) % 360;
            
            // Make lightness more reactive and ensure it doesn't go too dark
            const lightness = 0.3 + audioData.rms * 0.3 + (audioData.beat ? 0.25 : 0) + settings.brightCap * 0.15;
            const [r, g, bVal] = hslToRgb(targetHue, 90 + Math.random()*10, Math.min(0.8, lightness) * 100);
            tempColor.setRGB(r, g, bVal);
    
            if (segment.material instanceof THREE.MeshBasicMaterial) {
                segment.material.color.lerp(tempColor, 0.1);
                segment.material.opacity = Math.min(0.8, 0.5 + audioData.rms * 0.3 + settings.brightCap * 0.2);
            }
    
            segment.rotation.z += (audioData.trebleEnergy * 0.025 + 0.001 + audioData.bpm * 0.00002) * (i % 2 === 0 ? 1.2 : -1.4) * deltaTime * 60;
            segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0006 + i * 0.35) * audioData.midEnergy * 0.6;
        });
    
        // Camera FOV effect for speed/warping
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = cameraBaseFov - audioData.rms * 35 * settings.gamma + (audioData.beat ? 8 : 0) ; // Zoom in/out with RMS/beat
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
    rendererType: 'webgl', // Changed to WebGL
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins', // SBNF Cream on Black
    dataAiHint: 'strobe light flash',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      // Ortho camera for full-screen effect
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      
      // Full-screen quad
      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeMaterial = new THREE.MeshBasicMaterial({ 
        color: SBNF_HUES_SCENE.black, // Default to black
        transparent: true, 
        opacity: 0 
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(planeMesh);

      return {
        scene,
        camera,
        planeMesh, // The full-screen quad
        planeMaterial, // Its material
        tempColor: new THREE.Color(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // Base background if quad is transparent
        lastFrameTime: performance.now(),
      } as WebGLSceneAssets & { planeMesh: THREE.Mesh, planeMaterial: THREE.MeshBasicMaterial, tempColor: THREE.Color, bgColor: THREE.Color, lastFrameTime: number };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.planeMesh || !webGLAssets.planeMaterial || !webGLAssets.tempColor || !webGLAssets.bgColor || !webGLAssets.lastFrameTime) return;
      const { planeMesh, planeMaterial, tempColor, bgColor } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0;
      webGLAssets.lastFrameTime = currentTime;

      // Default to clearing with the SBNF Black (renderer clear color is set during scene init in VisualizerView)
      // renderer.setClearColor(bgColor.getHex(), 1); 
      // renderer.clear(); // Not strictly needed if the quad covers everything

      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
        const lightness = 80 + Math.random() * 15; // Bright
        const [r,g,bVal] = hslToRgb(hue, 100, lightness);
        tempColor.setRGB(r,g,bVal);
        
        planeMaterial.color.copy(tempColor);
        planeMaterial.opacity = Math.min(1, settings.brightCap * 1.2); // Flash opacity
      } else {
        // Fade out the flash or stay black
        planeMaterial.opacity = Math.max(0, planeMaterial.opacity - deltaTime * 5.0); // Fast fade out
        if (planeMaterial.opacity <= 0.01) {
          planeMaterial.color.set(bgColor.getHex()); // Set to background color when fully faded
          planeMaterial.opacity = 1; // Make it opaque black (or background color)
        }
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.planeMesh && webGLAssets.planeMesh.geometry) webGLAssets.planeMesh.geometry.dispose();
        if (webGLAssets.planeMaterial) webGLAssets.planeMaterial.dispose();
      }
    }
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale&font=poppins', // SBNF Orange-Yellow on Deep Purple
    dataAiHint: 'grand particle explosion confetti fireworks',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 400;

      const PARTICLE_COUNT = 1800; // Reduced from 2500
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); // Store x,y,z components
      const lifetimes = new Float32Array(PARTICLE_COUNT); // Each particle has a lifetime

      for (let i = 0; i < PARTICLE_COUNT; i++) {
          lifetimes[i] = 0; // All particles start dead
          const pIdx = i * 3;
          positions[pIdx] = 10000; positions[pIdx + 1] = 10000; positions[pIdx + 2] = 10000; // Start off-screen
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 1.8, // Slightly reduced base size
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      return {
        scene, camera, particles, material, geometry,
        positions, colors, velocities, lifetimes, // Keep these directly accessible
        PARTICLE_COUNT,
        lastBeatTime: 0,
        tempColor: new THREE.Color(),
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        rotationSpeed: new THREE.Vector3(0.015, 0.02, 0.007), // Slower base rotation
      } as WebGLSceneAssets & { particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; PARTICLE_COUNT: number; lastBeatTime: number; tempColor: THREE.Color; lastFrameTime: number; bgColor: THREE.Color; rotationSpeed: THREE.Vector3; };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.lastFrameTime) return; // Add null checks for all potentially undefined webGLAssets properties
        const { particles, material, geometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor, rotationSpeed } = webGLAssets;
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // Delta time in seconds
        webGLAssets.lastFrameTime = currentTime;
    
        renderer.setClearColor(bgColor.getHex(), 0.08); // Slightly less trail
        renderer.clear();
    
        const beatCooldown = 150; // ms, slightly longer cooldown
        const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender];
    
        if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            let particlesToSpawnThisBeat = Math.floor(PARTICLE_COUNT * (0.1 + audioData.bassEnergy * 0.25)); // Reduced spawn rate
            particlesToSpawnThisBeat = Math.min(particlesToSpawnThisBeat, PARTICLE_COUNT * 0.25); // Cap spawn per beat

            let spawnedCount = 0;
            for (let i = 0; i < PARTICLE_COUNT && spawnedCount < particlesToSpawnThisBeat; i++) {
                if (lifetimes[i] <= 0) { // Find a "dead" particle to reuse
                    const pIdx = i * 3;
                    // Spawn near center
                    positions[pIdx] = (Math.random() - 0.5) * 5;
                    positions[pIdx + 1] = (Math.random() - 0.5) * 5;
                    positions[pIdx + 2] = (Math.random() - 0.5) * 5;
    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1.0); 
                    const speed = 150 + Math.random() * 180 + audioData.bassEnergy * 250 + audioData.rms * 120; // Slightly reduced max speed
                    velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);
    
                    const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
                    const [r,g,bVal] = hslToRgb(hue, 90 + Math.random() * 10, 50 + Math.random() * 20); // Less max lightness
                    tempColor.setRGB(r,g,bVal);
                    colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;
    
                    lifetimes[i] = 1.2 + Math.random() * 1.3; // Shorter max lifetime
                    spawnedCount++;
                }
            }
        }
    
        // Update particles
        const dragFactor = 0.96; // Slightly stronger drag
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (lifetimes[i] > 0) { 
                const pIdx = i * 3;
                lifetimes[i] -= deltaTime;
                if (lifetimes[i] <= 0) {
                    positions[pIdx] = 10000; // Move off-screen
                    velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0;
                    colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0;
                    continue;
                }
    
                velocities[pIdx] *= dragFactor; 
                velocities[pIdx + 1] *= dragFactor; 
                velocities[pIdx + 2] *= dragFactor;
    
                positions[pIdx] += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;
                
                // Fade color based on lifetime
                const lifeRatio = Math.max(0, lifetimes[i] / (1.2 + Math.random() * 1.3)); // Use consistent max lifetime for fade calc
                colors[pIdx] *= lifeRatio; 
                colors[pIdx+1] *= lifeRatio; 
                colors[pIdx+2] *= lifeRatio;
            }
        }
    
        if (geometry.attributes.position) geometry.attributes.position.needsUpdate = true;
        if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
    
        material.size = (1.5 + audioData.rms * 3.0) * Math.max(0.1, settings.brightCap); // Smaller size overall
        material.opacity = Math.max(0.1, settings.brightCap * (0.3 + audioData.rms * 0.5)); // Less base opacity

        if (particles && rotationSpeed) {
            particles.rotation.x += rotationSpeed.x * deltaTime * (0.3 + audioData.midEnergy * 0.7);
            particles.rotation.y += rotationSpeed.y * deltaTime * (0.3 + audioData.trebleEnergy * 0.7);
        }
        if(camera) camera.position.z = 400 + audioData.rms * 200; // Less pullback
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.geometry) webGLAssets.geometry.dispose();
            if (webGLAssets.material) webGLAssets.material.dispose();
            // velocities, positions, colors, lifetimes are typed arrays on geometry, no separate dispose
        }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";
