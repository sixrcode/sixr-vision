
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
  showWebcam: false,
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
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const webGLAssets: Partial<WebGLSceneAssets> & { planeMesh?: THREE.Mesh, videoTexture?: THREE.VideoTexture, shaderMaterial?: THREE.ShaderMaterial, bgColor?: THREE.Color } = { scene, camera, bgColor: new THREE.Color(0x000000) }; // Start with black bg

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
            // Difference blend for silhouette
            vec3 diffColor = abs(dynamicColor - webcamColor.rgb);
            // Make it more silhouetted by emphasizing high diff, then tinting
            float silhouetteFactor = smoothstep(0.2, 0.6, dot(diffColor, vec3(0.333)));
            vec3 finalColor = mix(dynamicColor * 0.3, dynamicColor, silhouetteFactor); // Tinted silhouette
            
            gl_FragColor = vec4(finalColor, webcamColor.a * opacityFactor * silhouetteFactor);
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
      } else {
         webGLAssets.bgColor = new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`);
      }
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      if (!renderer || !scene || !camera || !webGLAssets) return;
      const { planeMesh, shaderMaterial, videoTexture, bgColor } = webGLAssets as any;

      if (planeMesh && shaderMaterial && videoTexture && settings.showWebcam && webcamElement && webcamElement.readyState >= webcamElement.HAVE_ENOUGH_DATA) {
        renderer.setClearColor(0x000000, 0); // Transparent clear if webcam is showing
        videoTexture.needsUpdate = true;
        shaderMaterial.uniforms.mirrorX.value = settings.mirrorWebcam;
        
        const overallOpacity = Math.max(0.1, settings.brightCap * (0.7 + audioData.rms * 0.3));
        shaderMaterial.uniforms.opacityFactor.value = overallOpacity;

        const hueTimeShift = (performance.now() / 12000) * 360;
        const baseHue = (SBNF_HUES_SCENE.lightLavender + audioData.midEnergy * 60 + hueTimeShift) % 360;
        const saturation = 70 + audioData.trebleEnergy * 30;
        const lightness = 50 + audioData.bassEnergy * 25 + (audioData.beat ? 10 : 0);
        const [r, g, b] = hslToRgb(baseHue, saturation, lightness);
        shaderMaterial.uniforms.dynamicColor.value.setRGB(r, g, b);
        
        const canvasAspect = canvasWidth / canvasHeight;
        const videoAspect = webcamElement.videoWidth / webcamElement.videoHeight;
        if (planeMesh.geometry.parameters.width !== canvasWidth || planeMesh.geometry.parameters.height !== canvasHeight) {
            planeMesh.geometry.dispose();
            planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
        }
        if (canvasAspect > videoAspect) {
            videoTexture.repeat.x = videoAspect / canvasAspect; videoTexture.repeat.y = 1;
            videoTexture.offset.x = (1 - videoTexture.repeat.x) / 2; videoTexture.offset.y = 0;
        } else {
            videoTexture.repeat.x = 1; videoTexture.repeat.y = canvasAspect / videoAspect;
            videoTexture.offset.x = 0; videoTexture.offset.y = (1 - videoTexture.repeat.y) / 2;
        }
        scene.visible = true;
      } else {
        renderer.setClearColor(bgColor ? bgColor.getHex() : new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 47%)`).getHex(), 1);
        renderer.clear();
        if (planeMesh) scene.visible = false; // Hide plane if webcam not active
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if ((webGLAssets as any).videoTexture) (webGLAssets as any).videoTexture.dispose();
        if ((webGLAssets as any).planeMesh?.geometry) (webGLAssets as any).planeMesh.geometry.dispose();
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

      const circleGeom = new THREE.CircleGeometry(0.5, 32);
      const squareGeom = new THREE.PlaneGeometry(1, 1);
      const triangleShape = new THREE.Shape();
      triangleShape.moveTo(0, 0.5); triangleShape.lineTo(0.5 * Math.cos(Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(Math.PI / 6 + Math.PI / 2)); triangleShape.lineTo(0.5 * Math.cos(5 * Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(5 * Math.PI / 6 + Math.PI / 2)); triangleShape.closePath();
      const triangleGeom = new THREE.ShapeGeometry(triangleShape);

      return {
        scene, camera,
        geometries: [circleGeom, squareGeom, triangleGeom],
        activeShapes: [], lastSpawnTime: 0,
        spawnInterval: 100, shapeBaseLifetime: 2500,
        lastFrameTime: performance.now(), tempColor: new THREE.Color(),
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`), // SBNF Black for bg
      } as WebGLSceneAssets & { geometries: THREE.BufferGeometry[], activeShapes: any[], lastSpawnTime: number, spawnInterval: number, shapeBaseLifetime: number, lastFrameTime: number, tempColor: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.geometries || !webGLAssets.activeShapes || !webGLAssets.bgColor || !webGLAssets.tempColor || !webGLAssets.lastFrameTime) return;
      const { geometries, activeShapes, shapeBaseLifetime, bgColor, tempColor } = webGLAssets as any;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime);
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearColor(bgColor.getHex(), 0.06); // Lower alpha for more prominent trails
      renderer.clear();

      const spawnInterval = (webGLAssets as any).spawnInterval / (1 + audioData.rms * 3); // Spawn rate less sensitive
      const spawnCondition = audioData.beat || (audioData.rms > 0.02 && currentTime - (webGLAssets as any).lastSpawnTime > spawnInterval);

      if (spawnCondition && activeShapes.length < 50) { // Reduced cap
        (webGLAssets as any).lastSpawnTime = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 1.5 + audioData.bassEnergy * 1 + (audioData.beat ? 1: 0)); // Reduced spawn count

        for (let k = 0; k < numToSpawn; k++) {
          const geom = geometries[Math.floor(Math.random() * geometries.length)];
          const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geom, material);
          const sizeBase = (10 + audioData.bassEnergy * 100 + Math.random() * 40);
          const initialScale = sizeBase * Math.max(0.1, settings.brightCap) * (0.2 + audioData.midEnergy * 0.6);
          if (initialScale < 5) continue;

          mesh.position.set((Math.random() - 0.5) * canvasWidth * 0.9, (Math.random() - 0.5) * canvasHeight * 0.9, 0);
          mesh.scale.set(initialScale * 0.05, initialScale * 0.05, 1);
          const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];
          const baseObjectHue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
          const hue = (baseObjectHue + (audioData.spectrum[k*5 % audioData.spectrum.length] / 255) * 30 + (audioData.beat ? 20:0) + performance.now()/350) % 360;
          const [r,g,bVal] = hslToRgb(hue, 80 + Math.random()*20, 50 + Math.random()*25);
          material.color.setRGB(r,g,bVal);
          const lifetime = shapeBaseLifetime * (0.7 + Math.random() * 0.7);
          const growInDuration = 200 + Math.random() * 150;
          activeShapes.push({ mesh, spawnTime: currentTime, lifetime, initialScale, rotationSpeed: (Math.random() - 0.5) * 0.002 * (1 + audioData.trebleEnergy), growInDuration });
          scene.add(mesh);
        }
      }
      for (let i = activeShapes.length - 1; i >= 0; i--) {
        const shape = activeShapes[i];
        const age = currentTime - shape.spawnTime;
        if (age > shape.lifetime) {
          scene.remove(shape.mesh); if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose(); activeShapes.splice(i, 1); continue;
        }
        const lifeProgress = age / shape.lifetime;
        const growInPhase = Math.min(1.0, age / shape.growInDuration);
        let currentScaleFactor = growInPhase;
        if (age > shape.growInDuration) currentScaleFactor = 1 + Math.sin((age - shape.growInDuration) * 0.0025 * (1 + audioData.midEnergy * 1.5)) * 0.1;
        const finalScale = shape.initialScale * currentScaleFactor;
        shape.mesh.scale.set(finalScale, finalScale, finalScale);
        const targetOpacity = (0.2 + audioData.trebleEnergy * 0.4 + audioData.rms * 0.3) * settings.brightCap * 1.1;
        (shape.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, (1.0 - lifeProgress) * targetOpacity * growInPhase));
        shape.mesh.rotation.z += shape.rotationSpeed * deltaTime * 0.05;
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if ((webGLAssets as any).activeShapes) {
          (webGLAssets as any).activeShapes.forEach((shape: any) => { if ((webGLAssets as any).scene) (webGLAssets as any).scene.remove(shape.mesh); if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose(); });
          (webGLAssets as any).activeShapes = [];
        }
        if ((webGLAssets as any).geometries) { (webGLAssets as any).geometries.forEach((geom: THREE.BufferGeometry) => geom.dispose()); }
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
            scene, camera, activeRings: [], ringGeometry,
            lastSpawnTimes: [0,0,0], tempColor: new THREE.Color(),
            bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`),
        } as WebGLSceneAssets & { activeRings: any[], ringGeometry: THREE.BufferGeometry, lastSpawnTimes: number[], tempColor: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.ringGeometry || !webGLAssets.activeRings || !webGLAssets.lastSpawnTimes || !webGLAssets.tempColor || !webGLAssets.bgColor) return;
        const { ringGeometry, activeRings, lastSpawnTimes, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        renderer.setClearColor(bgColor.getHex(), 0.10); // Adjusted alpha
        renderer.clear();
        const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
        const baseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
        const spawnIntervals = [150, 120, 100];
        const maxRingRadius = Math.min(canvasWidth, canvasHeight) * 0.48;

        energies.forEach((energy, i) => {
            const effectiveEnergy = Math.max(0.015, energy);
            if (energy > 0.035 && currentTime - lastSpawnTimes[i] > spawnIntervals[i] / (effectiveEnergy * 4 + 0.1)) {
                lastSpawnTimes[i] = currentTime;
                const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, opacity: 0 });
                const ringMesh = new THREE.Mesh(ringGeometry, material);
                const hue = (baseHues[i] + (audioData.spectrum[i * 10 % audioData.spectrum.length] / 255) * 35 + (audioData.beat ? 20 : 0) + performance.now()/450) % 360;
                const [r,g,bVal] = hslToRgb(hue, 85 + energy*15, 55 + energy*25);
                tempColor.setRGB(r,g,bVal);
                material.color.copy(tempColor);
                activeRings.push({ mesh: ringMesh, spawnTime: currentTime, lifetime: 1100 + energy * 1200, maxRadius: maxRingRadius * (0.2 + energy * 0.8) });
                scene.add(ringMesh);
            }
        });
        for (let i = activeRings.length - 1; i >= 0; i--) {
            const ring = activeRings[i];
            const age = currentTime - ring.spawnTime;
            if (age > ring.lifetime) {
                scene.remove(ring.mesh); if (ring.mesh.material) (ring.mesh.material as THREE.Material).dispose(); activeRings.splice(i, 1); continue;
            }
            const lifeProgress = age / ring.lifetime;
            const currentRadius = lifeProgress * ring.maxRadius;
            if (currentRadius < 0.5) continue;
            ring.mesh.scale.set(currentRadius, currentRadius, 1);
            const opacityFade = Math.sin(Math.PI * (1.0 - lifeProgress));
            const alpha = opacityFade * (0.35 + audioData.rms * 0.55) * settings.brightCap * 1.2;
            (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, Math.max(0, alpha)); // Capped max opacity
        }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if ((webGLAssets as any).activeRings) {
          (webGLAssets as any).activeRings.forEach((ring: any) => { if ((webGLAssets as any).scene) (webGLAssets as any).scene.remove(ring.mesh); if (ring.mesh.material) (ring.mesh.material as THREE.Material).dispose(); });
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
        const GRID_SIZE_X = 16; const GRID_SIZE_Y = Math.floor(GRID_SIZE_X * (canvas.height / canvas.width)); const totalCells = GRID_SIZE_X * GRID_SIZE_Y;
        const cellGeom = new THREE.PlaneGeometry(1, 1); const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: false });
        const instancedMesh = new THREE.InstancedMesh(cellGeom, cellMaterial, totalCells);
        scene.add(instancedMesh);
        const cellWidth = canvas.width / GRID_SIZE_X; const cellHeight = canvas.height / GRID_SIZE_Y;
        const dummy = new THREE.Object3D(); const initialColor = new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`);
        const cellStates: { currentColor: THREE.Color, targetColor: THREE.Color, lastUpdateTime: number, currentScale: number }[] = [];
        for (let j_idx = 0; j_idx < GRID_SIZE_Y; j_idx++) {
            for (let i_idx = 0; i_idx < GRID_SIZE_X; i_idx++) {
                const index = j_idx * GRID_SIZE_X + i_idx;
                dummy.position.set((i_idx - GRID_SIZE_X / 2 + 0.5) * cellWidth, (j_idx - GRID_SIZE_Y / 2 + 0.5) * cellHeight, 0);
                dummy.scale.set(cellWidth * 0.85, cellHeight * 0.85, 1); dummy.updateMatrix(); // Slightly larger cells
                instancedMesh.setMatrixAt(index, dummy.matrix); instancedMesh.setColorAt(index, initialColor);
                cellStates.push({ currentColor: new THREE.Color().copy(initialColor), targetColor: new THREE.Color().copy(initialColor), lastUpdateTime: 0, currentScale: 0.85 });
            }
        }
        if (instancedMesh.instanceMatrix) instancedMesh.instanceMatrix.needsUpdate = true; 
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        return {
            scene, camera, instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellWidth, cellHeight, cellStates,
            dummy: new THREE.Object3D(), tempColor: new THREE.Color(), lastFrameTime: performance.now(),
            bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, GRID_SIZE_X: number, GRID_SIZE_Y: number, totalCells: number, cellWidth: number, cellHeight: number, cellStates: any[], dummy: THREE.Object3D, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.cellStates || !webGLAssets.dummy || !webGLAssets.tempColor || !webGLAssets.bgColor || !webGLAssets.lastFrameTime) return;
        const { instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellWidth, cellHeight, cellStates, dummy, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now(); webGLAssets.lastFrameTime = currentTime;
        renderer.setClearColor(bgColor.getHex(), 1); renderer.clear();
        const spectrum = audioData.spectrum; const spectrumLength = spectrum.length;
        const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];
        for (let j_idx = 0; j_idx < GRID_SIZE_Y; j_idx++) {
            for (let i_idx = 0; i_idx < GRID_SIZE_X; i_idx++) {
                const index = j_idx * GRID_SIZE_X + i_idx;
                const spectrumIndex = Math.floor((index / totalCells) * spectrumLength) % spectrumLength; 
                const energy = spectrum[spectrumIndex] / 255; const cellState = cellStates[index];
                const beatFactor = audioData.beat ? 1.4 : 1.0;
                const targetLightness = 0.3 + energy * 0.45 * beatFactor * settings.brightCap;
                const targetSaturation = 0.80 + energy * 0.20;
                const baseHue = sbnfHues[(i_idx + j_idx + Math.floor(currentTime / 1800)) % sbnfHues.length];
                const hue = (baseHue + energy * 45 + (audioData.beat ? 25 : 0)) % 360;
                const [r,g,bVal] = hslToRgb(hue, Math.min(100, targetSaturation*100), Math.min(100, targetLightness*100));
                cellState.targetColor.setRGB(r,g,bVal);
                cellState.currentColor.lerp(cellState.targetColor, 0.15);
                instancedMesh.setColorAt(index, cellState.currentColor);
                const baseScaleFactor = 0.85;
                const scalePulse = 1.0 + energy * 0.12 * beatFactor * audioData.rms;
                const targetScale = baseScaleFactor * scalePulse;
                cellState.currentScale = cellState.currentScale * 0.85 + targetScale * 0.15;
                instancedMesh.getMatrixAt(index, dummy.matrix);
                const currentPosition = new THREE.Vector3().setFromMatrixPosition(dummy.matrix);
                dummy.scale.set(cellWidth * cellState.currentScale, cellHeight * cellState.currentScale, 1);
                dummy.position.copy(currentPosition); dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
            }
        }
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        if (instancedMesh.instanceMatrix) instancedMesh.instanceMatrix.needsUpdate = true;
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
      const numBars = Math.floor((settings.fftSize / 2) * 0.8); // Use fewer bars for better spacing
      const barWidthRatio = 0.7; // How much of the available space a bar takes
      const totalBarUnits = numBars * (1 / barWidthRatio); // Effective units for spacing
      const barWidth = canvas.width / totalBarUnits * 0.9; // Actual width with gaps

      const barGeometry = new THREE.PlaneGeometry(barWidth, 1);
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: false });
      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      const dummy = new THREE.Object3D();
      const initialColor = new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 5%)`);
      for (let i = 0; i < numBars; i++) {
        const xPosition = (i - numBars / 2 + 0.5) * (barWidth / barWidthRatio);
        dummy.position.set(xPosition, -canvas.height / 2 + 0.5, 0);
        dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, initialColor);
      }
      scene.add(instancedMesh);
      return {
        scene, camera, instancedMesh, numBars, barWidth: barWidth / barWidthRatio, // Pass effective width with gap
        dummy: new THREE.Object3D(), color: new THREE.Color(),
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`), // SBNF Black
      } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, numBars: number, barWidth: number, dummy: THREE.Object3D, color: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.dummy || !webGLAssets.color || !webGLAssets.bgColor) return;
      const { instancedMesh, numBars, barWidth, dummy, color, bgColor } = webGLAssets as any;
      renderer.setClearColor(bgColor.getHex(), 1); renderer.clear();
      const spectrum = audioData.spectrum;
      const effectiveBrightCap = Math.max(0.05, settings.brightCap);
      const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];
      const spectrumSumForSilenceCheck = spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (numBars * 0.5);

      for (let i = 0; i < numBars; i++) {
        if (i >= spectrum.length) continue;
        const normalizedValue = isAudioSilent ? 0.002 : (spectrum[i] || 0) / 255;
        const barHeightBase = normalizedValue * canvasHeight * effectiveBrightCap * 1.2;
        const barHeight = Math.max(1, barHeightBase * (0.35 + audioData.rms * 0.65 + (audioData.beat ? 0.20 : 0)));
        dummy.scale.set(1, barHeight, 1);
        const xPosition = (i - numBars / 2 + 0.5) * barWidth;
        dummy.position.set(xPosition, barHeight / 2 - canvasHeight / 2, 0);
        dummy.updateMatrix(); instancedMesh.setMatrixAt(i, dummy.matrix);
        const hueIndex = Math.floor((i / numBars) * sbnfHues.length);
        const baseHue = sbnfHues[hueIndex % sbnfHues.length];
        const hue = (baseHue + normalizedValue * 25 + (audioData.beat ? 25 : 0) + performance.now() / 220) % 360;
        const saturation = 75 + normalizedValue * 25;
        const lightness = 35 + normalizedValue * 40 + (audioData.beat ? 15 : 0);
        const [r,g,bVal] = hslToRgb(hue, Math.min(100, saturation), Math.min(80, lightness));
        color.setRGB(r, g, bVal); instancedMesh.setColorAt(i, color);
      }
      if (instancedMesh.instanceMatrix) instancedMesh.instanceMatrix.needsUpdate = true;
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
      camera.position.z = 250; // Closer camera

      const PARTICLE_COUNT = 4000; // Reduced particle count
      const positions = new Float32Array(PARTICLE_COUNT * 3); const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); const lifetimes = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) { lifetimes[i] = 0; }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({ size: 2.5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      const particles = new THREE.Points(geometry, material); scene.add(particles);
      return {
        scene, camera, particles, material, geometry, positions, colors, velocities, lifetimes,
        PARTICLE_COUNT, lastBeatTime: 0, lastAmbientSpawnTime: 0, tempColor: new THREE.Color(),
        lastFrameTime: performance.now(), bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
      } as WebGLSceneAssets & { particles: THREE.Points, material: THREE.PointsMaterial, geometry: THREE.BufferGeometry, positions: Float32Array, colors: Float32Array, velocities: Float32Array, lifetimes: Float32Array, PARTICLE_COUNT: number, lastBeatTime: number, lastAmbientSpawnTime: number, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.bgColor || !webGLAssets.lastFrameTime) return;
      const { particles, material, geometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor } = webGLAssets as any;
      const currentTime = performance.now(); const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; webGLAssets.lastFrameTime = currentTime;
      renderer.setClearColor(bgColor.getHex(), 0.12); renderer.clear(); // Slightly less trail persistence
      const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
      const sbnfHuesAmbient = [SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];
      let spawnedThisFrame = 0;
      const beatCooldown = 120; // ms
      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown) && spawnedThisFrame < PARTICLE_COUNT * 0.25) { // Adjusted spawn cap
        webGLAssets.lastBeatTime = currentTime;
        let burstParticlesSpawned = 0;
        const maxBurstParticlesThisBeat = Math.floor(PARTICLE_COUNT * (0.08 + audioData.bassEnergy * 0.25)); // Reduced multipliers
        for (let i = 0; i < PARTICLE_COUNT && burstParticlesSpawned < maxBurstParticlesThisBeat; i++) {
          if (lifetimes[i] <= 0) {
            const pIdx = i * 3; positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;
            const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1);
            const speed = 80 + Math.random() * 180 + audioData.bassEnergy * 250 + audioData.rms * 120; // Slightly reduced speed
            velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta); velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta); velocities[pIdx + 2] = speed * Math.cos(phi);
            const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
            const [r, g, bVal] = hslToRgb(hue, 100, 55 + Math.random() * 20); // Capped lightness
            tempColor.setRGB(r, g, bVal); colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;
            lifetimes[i] = 0.8 + Math.random() * 1.2; burstParticlesSpawned++; spawnedThisFrame++;
          }
        }
      }
      const ambientSpawnRate = 25 + audioData.rms * 120; const ambientSpawnInterval = 1000 / Math.max(1, ambientSpawnRate);
      if (currentTime - webGLAssets.lastAmbientSpawnTime > ambientSpawnInterval && spawnedThisFrame < PARTICLE_COUNT * 0.03) { // Reduced ambient cap
        webGLAssets.lastAmbientSpawnTime = currentTime;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          if (lifetimes[i] <= 0) {
            const pIdx = i * 3; positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;
            const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1.0);
            const speed = 15 + Math.random() * 40 + audioData.midEnergy * 70;
            velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta); velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta); velocities[pIdx + 2] = speed * Math.cos(phi);
            const hue = sbnfHuesAmbient[Math.floor(Math.random() * sbnfHuesAmbient.length)];
            const [r, g, bVal] = hslToRgb(hue, 75 + Math.random() * 25, 45 + Math.random() * 25);
            tempColor.setRGB(r, g, bVal); colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;
            lifetimes[i] = 1.3 + Math.random() * 1.8; spawnedThisFrame++; break;
          }
        }
      }
      const dragFactor = 0.975; // Slightly increased drag
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (lifetimes[i] > 0) {
          const pIdx = i * 3; lifetimes[i] -= deltaTime;
          if (lifetimes[i] <= 0) { colors[pIdx + 0] = 0; colors[pIdx + 1] = 0; colors[pIdx + 2] = 0; velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0; continue; }
          velocities[pIdx] *= dragFactor; velocities[pIdx + 1] *= dragFactor; velocities[pIdx + 2] *= dragFactor;
          positions[pIdx] += velocities[pIdx] * deltaTime; positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime; positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;
          const lifeRatio = Math.max(0, lifetimes[i] / (0.8 + Math.random() * 1.2));
          colors[pIdx + 0] *= lifeRatio * 0.975 + 0.025; colors[pIdx + 1] *= lifeRatio * 0.975 + 0.025; colors[pIdx + 2] *= lifeRatio * 0.975 + 0.025;
        }
      }
      if(geometry.attributes.position) geometry.attributes.position.needsUpdate = true;
      if(geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
      material.size = (2.0 + audioData.rms * 4.0) * Math.max(0.1, settings.brightCap); // Adjusted size reactivity
      material.opacity = Math.max(0.1, settings.brightCap * (0.4 + audioData.rms * 0.45));
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) { if ((webGLAssets as any).geometry) (webGLAssets as any).geometry.dispose(); if ((webGLAssets as any).material) (webGLAssets as any).material.dispose(); }
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
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 50;
      const numSegments = 20; const segmentDepth = 100; const segmentRadius = 100;
      const segmentGeometry = new THREE.TorusGeometry(segmentRadius, 2.5, 12, 24); // Reduced segments for performance
      const segments: THREE.Mesh[] = [];
      for (let i = 0; i < numSegments; i++) {
        const material = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.65 }); // Slightly lower opacity
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * segmentDepth; segment.rotation.x = Math.PI / 2;
        scene.add(segment); segments.push(segment);
      }
      return {
        scene, camera, segments, numSegments, segmentDepth, segmentSpeed: 130, cameraBaseFov: 75, // Slightly slower base speed
        tempColor: new THREE.Color(), lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
      } as WebGLSceneAssets & { segments: THREE.Mesh[], numSegments: number, segmentDepth: number, segmentSpeed: number, cameraBaseFov: number, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.segments || !(camera instanceof THREE.PerspectiveCamera) || !webGLAssets.cameraBaseFov || !webGLAssets.tempColor || !webGLAssets.lastFrameTime || !webGLAssets.bgColor) return;
        const { segments, segmentDepth, numSegments, segmentSpeed, cameraBaseFov, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now(); const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; webGLAssets.lastFrameTime = currentTime;
        renderer.setClearColor(bgColor.getHex(), 1); renderer.clear();
        segments.forEach((segment: THREE.Mesh, i: number) => {
            segment.position.z += segmentSpeed * (1 + audioData.rms * 1.2 + (audioData.beat ? 0.4 : 0)) * deltaTime; // Adjusted reactivity
            if (segment.position.z > camera.position.z + segmentDepth / 2) segment.position.z -= numSegments * segmentDepth;
            const hueOptions = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.lightLavender];
            const baseHue = hueOptions[(i + Math.floor(currentTime * 0.00025)) % hueOptions.length];
            const audioInfluence = audioData.rms * 50 + (audioData.spectrum[i % audioData.spectrum.length] / 255) * 35;
            const targetHue = (baseHue + audioInfluence + (audioData.beat ? 25 : 0)) % 360;
            const lightness = 0.25 + audioData.rms * 0.25 + (audioData.beat ? 0.20 : 0) + settings.brightCap * 0.12;
            const [r, g, bVal] = hslToRgb(targetHue, 85 + Math.random()*15, Math.min(0.75, lightness) * 100);
            tempColor.setRGB(r, g, bVal);
            if (segment.material instanceof THREE.MeshBasicMaterial) {
                segment.material.color.lerp(tempColor, 0.12); // Slightly faster lerp
                segment.material.opacity = Math.min(0.75, 0.45 + audioData.rms * 0.25 + settings.brightCap * 0.15);
            }
            segment.rotation.z += (audioData.trebleEnergy * 0.020 + 0.0008 + audioData.bpm * 0.000015) * (i % 2 === 0 ? 1.1 : -1.3) * deltaTime * 60;
            segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0005 + i * 0.3) * audioData.midEnergy * 0.5;
        });
        camera.fov = cameraBaseFov - audioData.rms * 30 * settings.gamma + (audioData.beat ? 7 : 0) ;
        camera.fov = Math.max(45, Math.min(95, camera.fov)); camera.updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets && (webGLAssets as any).segments && (webGLAssets as any).scene) {
        (webGLAssets as any).segments.forEach((segment: THREE.Mesh) => { if (segment.geometry) segment.geometry.dispose(); if (segment.material) (segment.material as THREE.Material).dispose(); if ((webGLAssets as any).scene) (webGLAssets as any).scene.remove(segment); });
        (webGLAssets as any).segments = [];
      }
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins', // SBNF Cream on Black
    dataAiHint: 'strobe light flash',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(SBNF_HUES_SCENE.black), transparent: true, opacity: 1 });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial); scene.add(planeMesh);
      return {
        scene, camera, planeMesh,  planeMaterial, tempColor: new THREE.Color(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), lastFrameTime: performance.now(),
      } as WebGLSceneAssets & { planeMesh: THREE.Mesh, planeMaterial: THREE.MeshBasicMaterial, tempColor: THREE.Color, bgColor: THREE.Color, lastFrameTime: number };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.planeMesh || !webGLAssets.planeMaterial || !webGLAssets.tempColor || !webGLAssets.bgColor || !webGLAssets.lastFrameTime) return;
      const { planeMaterial, tempColor, bgColor } = webGLAssets as any;
      const currentTime = performance.now(); const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; webGLAssets.lastFrameTime = currentTime;
      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
        const lightness = 75 + Math.random() * 20; // Slightly less max brightness
        const [r,g,bVal] = hslToRgb(hue, 100, lightness); tempColor.setRGB(r,g,bVal);
        planeMaterial.color.copy(tempColor); planeMaterial.opacity = Math.min(1, settings.brightCap * 1.1); // Adjusted opacity
      } else {
        planeMaterial.opacity = Math.max(0, planeMaterial.opacity - deltaTime * 12.0); // Slightly faster fade
        if (planeMaterial.opacity <= 0.01) { planeMaterial.color.copy(bgColor); planeMaterial.opacity = 1; }
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if ((webGLAssets as any).planeMesh?.geometry) (webGLAssets as any).planeMesh.geometry.dispose();
        if ((webGLAssets as any).planeMaterial) (webGLAssets as any).planeMaterial.dispose();
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
      camera.position.z = 350; // Adjusted camera position

      const PARTICLE_COUNT = 3000; // Reduced count
      const positions = new Float32Array(PARTICLE_COUNT * 3); const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); const lifetimes = new Float32Array(PARTICLE_COUNT);
      const sbnfHuesInitial = [SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];
      const tempColorInit = new THREE.Color();
      for (let i = 0; i < PARTICLE_COUNT; i++) {
          lifetimes[i] = 0; const pIdx = i * 3;
          positions[pIdx] = 10000; positions[pIdx + 1] = 10000; positions[pIdx + 2] = 10000;
          const hue = sbnfHuesInitial[i % sbnfHuesInitial.length];
          const [r,g,bVal] = hslToRgb(hue, 60 + Math.random() * 30, 25 + Math.random() * 20);
          tempColorInit.setRGB(r,g,bVal);
          colors[pIdx] = tempColorInit.r; colors[pIdx + 1] = tempColorInit.g; colors[pIdx + 2] = tempColorInit.b;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }); // Reduced base size
      const particles = new THREE.Points(geometry, material); scene.add(particles);
      return {
        scene, camera, particles, material, geometry, positions, colors, velocities, lifetimes,
        PARTICLE_COUNT, lastBeatTime: 0, tempColor: new THREE.Color(),
        lastFrameTime: performance.now(), bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        rotationSpeed: new THREE.Vector3(0.008, 0.010, 0.004), // Slower base rotation
      } as WebGLSceneAssets & { particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; PARTICLE_COUNT: number; lastBeatTime: number; tempColor: THREE.Color; lastFrameTime: number; bgColor: THREE.Color; rotationSpeed: THREE.Vector3; };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.lastFrameTime || !webGLAssets.bgColor) return;
        const { particles, material, geometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor, rotationSpeed } = webGLAssets as any;
        const currentTime = performance.now(); const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; webGLAssets.lastFrameTime = currentTime;
        renderer.setClearColor(bgColor.getHex(), 0.08); renderer.clear(); // Faster clear for less blur
        const beatCooldown = 200; // Increased cooldown
        const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender];
        if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            let particlesToSpawn = Math.floor(PARTICLE_COUNT * (0.12 + audioData.bassEnergy * 0.20 + audioData.rms * 0.08)); // Reduced spawn multipliers
            particlesToSpawn = Math.min(particlesToSpawn, Math.floor(PARTICLE_COUNT * 0.20)); // Reduced spawn cap
            let spawnedCount = 0;
            for (let i = 0; i < PARTICLE_COUNT && spawnedCount < particlesToSpawn; i++) {
                if (lifetimes[i] <= 0) {
                    const pIdx = i * 3;
                    positions[pIdx] = (Math.random() - 0.5) * 3; positions[pIdx + 1] = (Math.random() - 0.5) * 3; positions[pIdx + 2] = (Math.random() - 0.5) * 3;
                    const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1.0);
                    const speed = 150 + Math.random() * 180 + audioData.bassEnergy * 220 + audioData.rms * 110; // Reduced speed
                    velocities[pIdx] = speed * Math.sin(phi) * Math.cos(theta); velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta); velocities[pIdx + 2] = speed * Math.cos(phi);
                    const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
                    const [r,g,bVal] = hslToRgb(hue, 85 + Math.random() * 15, 45 + Math.random() * 25); // Capped lightness
                    tempColor.setRGB(r,g,bVal); colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;
                    lifetimes[i] = 1.6 + Math.random() * 1.0; spawnedCount++; // Slightly shorter lifetime
                }
            }
        }
        const dragFactor = 0.978; // Slightly more drag
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (lifetimes[i] > 0) { 
                const pIdx = i * 3; lifetimes[i] -= deltaTime;
                if (lifetimes[i] <= 0) { positions[pIdx] = 10000; velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0; colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0; continue; }
                velocities[pIdx] *= dragFactor; velocities[pIdx + 1] *= dragFactor; velocities[pIdx + 2] *= dragFactor;
                positions[pIdx] += velocities[pIdx] * deltaTime; positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime; positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;
                const lifeRatio = Math.max(0, lifetimes[i] / (1.6 + Math.random() * 1.0));
                const fadeFactor = lifeRatio * 0.97 + 0.03; colors[pIdx] *= fadeFactor; colors[pIdx+1] *= fadeFactor; colors[pIdx+2] *= fadeFactor;
            }
        }
        if (geometry.attributes.position) geometry.attributes.position.needsUpdate = true;
        if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
        material.size = (1.5 + audioData.rms * 3.0) * Math.max(0.1, settings.brightCap); // Adjusted size reactivity
        material.opacity = Math.max(0.1, settings.brightCap * (0.3 + audioData.rms * 0.50));
        if (particles && rotationSpeed) {
            particles.rotation.x += rotationSpeed.x * deltaTime * (0.15 + audioData.midEnergy * 0.5);
            particles.rotation.y += rotationSpeed.y * deltaTime * (0.15 + audioData.trebleEnergy * 0.5);
        }
        if(camera && camera instanceof THREE.PerspectiveCamera) {
            camera.fov = 75 + audioData.rms * 3; // Very subtle fov change
            camera.fov = Math.max(72, Math.min(78, camera.fov)); camera.updateProjectionMatrix();
            camera.position.z = 350 - audioData.rms * 30; // Less pullback
        }
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) { if ((webGLAssets as any).geometry) (webGLAssets as any).geometry.dispose(); if ((webGLAssets as any).material) (webGLAssets as any).material.dispose(); }
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";
