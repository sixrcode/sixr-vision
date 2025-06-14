
import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets, ProceduralVine } from '@/types';
import * as THREE from 'three'; // Import the whole THREE namespace
import { SBNF_HUES_SCENE, hslToRgb, generateNoiseTexture } from '@/lib/constantsUtils';


// Hex colors for thumbnails based on SBNF Theme from globals.css
const SBNF_HEX_COLORS = {
  deepPurple: "5A36BB",
  lightLavender: "E1CCFF",
  orangeRed: "FF441A",
  orangeYellow: "FDB143",
  lightPeach: "FFECDA", // Often used for text
  black: "000000",
  tronBlue: "25A0E8", // Approximate HSL(197, 90%, 58%)
};

export const FFT_SIZES = [128, 256, 512] as const;

export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1,
  enableAgc: true,
  gamma: 1,
  dither: 0,
  brightCap: 1,
  logoOpacity: 0.25,
  showWebcam: false,
  mirrorWebcam: true,
  currentSceneId: 'radial_burst', // Default scene ID
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse',
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
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    displayLabel: 'BARS',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HEX_COLORS.deepPurple}/${SBNF_HEX_COLORS.orangeYellow}.png?text=BARS&font=poppins`,
    dataAiHint: 'audio spectrum analysis',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000); // No unused warning
      camera.position.z = 1;

      const numBars = Math.floor((settings.fftSize / 2)); 
      const barPlusGapWidth = (canvas.width * 0.98) / numBars; 
      const barActualWidth = barPlusGapWidth * 0.8;

      const barGeometry = new THREE.PlaneGeometry(barActualWidth, 1); 
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }); // No unused warning
      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      scene.add(instancedMesh); // No unused warning

      const dummy = new THREE.Object3D();
      const initialColor = new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple/360, 0.6, 0.3);

      for (let i = 0; i < numBars; i++) {
        const x = (i - (numBars - 1) / 2) * barPlusGapWidth;
        dummy.position.set(x, -canvas.height / 2 + 0.5, 0); 
        dummy.scale.set(1,1,1); 
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, initialColor);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      return {
        scene, camera, instancedMesh, numBars, barPlusGapWidth, barActualWidth, // Camera is used in drawWebGL
        dummy, tempColor: new THREE.Color(), bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.2), // Dummy and tempColor are used
        lastFrameTimeWebGL: performance.now(),
        lastCanvasWidth: canvas.width, // Used in drawWebGL
      } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets?.instancedMesh || !webGLAssets.dummy || !webGLAssets.tempColor) return;
      const instancedMesh = webGLAssets.instancedMesh as THREE.InstancedMesh;
      const dummy = webGLAssets.dummy as THREE.Object3D;
      const tempColor = webGLAssets.tempColor as THREE.Color;
      const bgColor = (webGLAssets as any).bgColor as THREE.Color; // bgColor is added in initWebGL, but not explicitly typed in WebGLSceneAssets union

      const currentTime = performance.now();
 webGLAssets.lastFrameTimeWebGL = webGLAssets.lastFrameTimeWebGL ?? currentTime; // Use nullish coalescing
      webGLAssets.lastFrameTimeWebGL = currentTime;

      renderer.setClearColor(bgColor.getHex(), 1);
      const SBNF_BAR_HUES = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];
      const effectiveBrightCap = Math.max(0.05, settings.brightCap);
      const hueTimeShift = (currentTime / 20000) * 360;
      let barPlusGapWidth = webGLAssets.barPlusGapWidth as number;
      let barActualWidth = webGLAssets.barActualWidth as number;
      const numBars = webGLAssets.numBars as number; // Added in initWebGL, but not explicitly typed in WebGLSceneAssets union

      if (canvasWidth !== webGLAssets.lastCanvasWidth) {
          webGLAssets.lastCanvasWidth = canvasWidth;
          barPlusGapWidth = (canvasWidth * 0.98) / numBars;
          barActualWidth = barPlusGapWidth * 0.8;
          webGLAssets.barActualWidth = barActualWidth;
          webGLAssets.barPlusGapWidth = barPlusGapWidth;
          
          if (instancedMesh.geometry) instancedMesh.geometry.dispose();
          instancedMesh.geometry = new THREE.PlaneGeometry(barActualWidth, 1);
      }

      const spectrum = audioData.spectrum;
      for (let i = 0; i < numBars; i++) {
        const value = spectrum[i] / 255;
        const barHeight = Math.max(1, value * canvasHeight * 0.8 * effectiveBrightCap * (1 + audioData.rms * 0.5));
        
        const x = (i - (numBars - 1) / 2) * barPlusGapWidth;
        dummy.position.set(x, barHeight / 2 - canvasHeight / 2 + 0.5, 0);
        dummy.scale.set(1, barHeight, 1);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        const hueIndex = Math.floor((i / numBars) * SBNF_BAR_HUES.length);
        const baseHue = SBNF_BAR_HUES[hueIndex];
        const hue = (baseHue + value * 40 + (audioData.beat ? 25 : 0) + hueTimeShift) % 360;
        const sat = 0.7 + value * 0.3;
        const light = Math.min(0.7, 0.3 + value * 0.45 + (audioData.beat ? 0.1 : 0));
        const [r,g,bVal] = hslToRgb(hue, sat * 100, light * 100);
        tempColor.setRGB(r, g, bVal);
 instancedMesh.setColorAt(i, tempColor); // No warning if tempColor is checked
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.scene?.remove(webGLAssets.instancedMesh!);
      webGLAssets.instancedMesh?.geometry?.dispose();
      (webGLAssets.instancedMesh?.material as THREE.Material)?.dispose();
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    displayLabel: 'BURST',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HEX_COLORS.black}/${SBNF_HEX_COLORS.orangeRed}.png?text=BURST&font=poppins`,
    dataAiHint: 'particle explosion audio beat',
    initWebGL: ({ scene, camera, renderer, webGLAssets }) => {
      const particleCount = 512;
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const velocities = [];
      const initialColors = [];

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * 2 * Math.PI;
        const radius = 0.2 + Math.random() * 0.5;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const z = (Math.random() - 0.5) * 0.2;

        positions.push(x, y, z);
        velocities.push(x * 0.01, y * 0.01, z * 0.01); // radial burst
        initialColors.push(new THREE.Color().setHSL(i / particleCount, 1, 0.5));
      }

      const positionAttr = new THREE.Float32BufferAttribute(positions, 3);
      geometry.setAttribute('position', positionAttr);

      const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      });

      const colors = new Float32Array(particleCount * 3);
      initialColors.forEach((color, i) => {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      });
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      webGLAssets.points = points;
      webGLAssets.velocities = velocities;
      webGLAssets.initialColors = initialColors;
      webGLAssets.lastCanvasWidth = 0;
      webGLAssets.lastCanvasHeight = 0;
      webGLAssets.bgColor = new THREE.Color(0x000010); // Deep night blue
      webGLAssets.initialized = false;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!scene || !camera || !renderer || !webGLAssets.points) return;

      webGLAssets.lastFrameTimeWebGL = webGLAssets.lastFrameTimeWebGL || performance.now();
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      renderer.setClearColor(bgColor.getHex(), 1.0); // Changed alpha to 1.0
      if (
        webGLAssets.lastCanvasWidth !== canvasWidth ||
        webGLAssets.lastCanvasHeight !== canvasHeight
      ) {
        camera.aspect = canvasWidth / canvasHeight;
        camera.updateProjectionMatrix();
        webGLAssets.lastCanvasWidth = canvasWidth;
        webGLAssets.lastCanvasHeight = canvasHeight;
      }

      renderer.setClearColor(webGLAssets.bgColor, 1.0);

      const positions = webGLAssets.points.geometry.attributes.position.array;
      const colors = webGLAssets.points.geometry.attributes.color.array;

      for (let i = 0; i < webGLAssets.velocities.length; i++) {
        // Update position
        const idx = i * 3;
        positions[idx] += webGLAssets.velocities[i][0];
        positions[idx + 1] += webGLAssets.velocities[i][1];
        positions[idx + 2] += webGLAssets.velocities[i][2];

        // Fade color over time
        colors[idx] *= 0.96;
        colors[idx + 1] *= 0.96;
        colors[idx + 2] *= 0.96;
      }
      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;

      const cam = camera as THREE.PerspectiveCamera;
      cam.position.z = 300 - audioData.rms * 100; 
      cam.fov = 75 - audioData.rms * 10; 
      cam.updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.scene?.remove(webGLAssets.particles!);
      webGLAssets.points.geometry.dispose();
      webGLAssets.points.material.dispose();
      webGLAssets.points = null;
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    displayLabel: 'ECHO',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HEX_COLORS.black}/${SBNF_HEX_COLORS.orangeYellow}.png?text=ECHO&font=poppins`,
    dataAiHint: 'glowing geometric shapes audio pulse',
 initWebGL: (canvas) => {
      const scene = new THREE.Scene(); // No unused warning
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const starfieldGeometry = new THREE.PlaneGeometry(2, 2);
      const starfieldMaterial = new THREE.ShaderMaterial({
        uniforms: {
          u_resolution_star: { value: new THREE.Vector2(canvas.width, canvas.height) },
          u_time_star: { value: 0.0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec2 u_resolution_star;
          uniform float u_time_star;
          varying vec2 vUv;

          float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p); f = f*f*(3.0 - 2.0*f);
            return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), f.x),
                       mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
          }

          void main() {
            vec2 uv_star = gl_FragCoord.xy / u_resolution_star.xy; // Use gl_FragCoord for stable stars
            float n = noise(uv_star * vec2(120.0, 120.0 * u_resolution_star.y / u_resolution_star.x) + u_time_star * 0.005); // Slower scroll
            float star = smoothstep(0.95, 0.97, n); // Smaller, sharper stars
            float twinkle = sin(u_time_star * 1.0 + uv_star.x * 70.0 + uv_star.y * 50.0) * 0.5 + 0.5; // Slower twinkle
            star *= (0.15 + twinkle * 0.1); // More subtle twinkle and base brightness

            gl_FragColor = vec4(vec3(star * 0.6), star * 0.4); // Dimmer stars
          }
        `,
        transparent: true,
        depthWrite: false,
      });
      const starfieldMesh = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
      starfieldMesh.renderOrder = -1;
      scene.add(starfieldMesh);
      
      const MAX_SHAPE_INSTANCES = 50;
      const circleGeometry = new THREE.CircleGeometry(0.5, 32);
      const squareGeometry = new THREE.PlaneGeometry(1, 1);
      const triShape = new THREE.Shape();
      triShape.moveTo(-0.5, -0.433); triShape.lineTo(0.5, -0.433); triShape.lineTo(0.0, 0.433); triShape.closePath();
      const triangleGeometry = new THREE.ShapeGeometry(triShape);

      const shapeMaterial = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7, 
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const circleInstancedMesh = new THREE.InstancedMesh(circleGeometry, shapeMaterial, MAX_SHAPE_INSTANCES);
      const squareInstancedMesh = new THREE.InstancedMesh(squareGeometry, shapeMaterial, MAX_SHAPE_INSTANCES);
      const triangleInstancedMesh = new THREE.InstancedMesh(triangleGeometry, shapeMaterial, MAX_SHAPE_INSTANCES);
      scene.add(circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh); // No unused warning

      return {
        scene, camera, starfieldMesh, starfieldMaterial, // Camera is used in drawWebGL
        circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh,
        shapeGeometries: { circle: circleGeometry, square: squareGeometry, triangle: triangleGeometry },
        shapeMaterial,
        activeInstances: [],
        MAX_SHAPE_INSTANCES,
        lastSpawnTimeShape: 0,
        spawnCooldownShape: 120, 
        dummy: new THREE.Object3D(),
        tempColor: new THREE.Color(),
        bgColor: new THREE.Color(0x000000), 
        lastFrameTimeWebGL: performance.now(),
      } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets?.activeInstances || !webGLAssets.starfieldMaterial || !webGLAssets.shapeMaterial || // Ensure these are not undefined
          !webGLAssets.circleInstancedMesh || !webGLAssets.squareInstancedMesh || !webGLAssets.triangleInstancedMesh ||
          !webGLAssets.dummy || !webGLAssets.tempColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined') return;

      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;
      
      webGLAssets.starfieldMaterial.uniforms.u_time_star.value = currentTime * 0.0005; 
      webGLAssets.starfieldMaterial.uniforms.u_resolution_star.value.set(canvasWidth, canvasHeight);
    
      const { activeInstances, MAX_SHAPE_INSTANCES, dummy, tempColor, spawnCooldownShape } = webGLAssets as WebGLSceneAssets & { activeInstances: any[], MAX_SHAPE_INSTANCES: number, dummy: THREE.Object3D, tempColor: THREE.Color, spawnCooldownShape: number, lastSpawnTimeShape: number };
      const { circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh } = webGLAssets as { circleInstancedMesh: THREE.InstancedMesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>, squareInstancedMesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>, triangleInstancedMesh: THREE.InstancedMesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>};
      
      renderer.setClearColor(webGLAssets.bgColor!.getHex(), 1); 

      const GRAPE_FAMILY_HUES = [SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.tronBlue];
      const hueTimeShift = (currentTime / 30000) * 360; 

      const spawnCondition = (audioData.beat && (currentTime - webGLAssets.lastSpawnTimeShape > spawnCooldownShape / 2)) ||
                             (audioData.rms > 0.08 && (currentTime - webGLAssets.lastSpawnTimeShape > spawnCooldownShape));

      if (spawnCondition && activeInstances.length < MAX_SHAPE_INSTANCES! * 3) {
        webGLAssets.lastSpawnTimeShape = currentTime; // Updated lastSpawnTimeShape
        const numToSpawn = 1 + Math.floor(audioData.rms * 1.5);

        for (let k = 0; k < numToSpawn; k++) {
 if (activeInstances.length >= MAX_SHAPE_INSTANCES * 3) break;
          
          const shapeTypes = ['circle', 'square', 'triangle'];
          const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
          
          let initialScale = (canvasWidth / 25) * (0.4 + audioData.bassEnergy * 0.6) * Math.max(0.1, settings.brightCap); 
          if (initialScale < 6) initialScale = 6; 

          const huePicker = Math.random();
          let selectedBaseHue;
          if (huePicker < 0.5) selectedBaseHue = SBNF_HUES_SCENE.deepPurple;      
          else if (huePicker < 0.75) selectedBaseHue = SBNF_HUES_SCENE.lightLavender; 
          else selectedBaseHue = GRAPE_FAMILY_HUES[2 + Math.floor(Math.random() * 3)]; 

          const finalHue = (selectedBaseHue + audioData.trebleEnergy * 25 + hueTimeShift) % 360;
          const [r,g,bVal] = hslToRgb(finalHue, 70 + audioData.trebleEnergy * 10, 0.55 + audioData.midEnergy * 0.10); 

 activeInstances.push({
            id: Math.random(), type: shapeType,
            x: (Math.random() - 0.5) * canvasWidth * 0.9,
            y: (Math.random() - 0.5) * canvasHeight * 0.9,
            z: (Math.random() - 0.5) * 3, 
            initialScale,
            maxScale: initialScale * (1.4 + audioData.rms * 2.0), 
            color: new THREE.Color(r, g, bVal),
            currentOpacity: Math.min(0.6, 0.4 + audioData.rms * 0.4) * settings.brightCap, 
            lifetime: 1.2 + Math.random() * 1.3, 
            spawnTime: currentTime,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.0018 * (1 + audioData.trebleEnergy),
          });
        }
      }

      let circleIdx = 0, squareIdx = 0, triangleIdx = 0;
      const newActiveInstances = [];

 for (let i = 0; i < activeInstances.length; i++) {
        const instance = activeInstances[i];
        const age = (currentTime - instance.spawnTime) / 1000.0; 
        const lifeProgress = age / instance.lifetime;

        if (lifeProgress >= 1) continue; 
        newActiveInstances.push(instance);

        const scaleProgress = Math.sin(lifeProgress * Math.PI); 
        instance.currentScale = instance.initialScale + (instance.maxScale - instance.initialScale) * scaleProgress;
        instance.currentScale = Math.max(0.01, instance.currentScale);
        instance.rotation += instance.rotationSpeed * deltaTime * 60;
        
        const finalOpacity = instance.currentOpacity * (1.0 - lifeProgress ** 1.5); 

        dummy!.position.set(instance.x, instance.y, instance.z);
        dummy!.rotation.z = instance.rotation;
        dummy!.scale.set(instance.currentScale, instance.currentScale, instance.currentScale);
        dummy!.updateMatrix();
        
 tempColor!.copy(instance.color as THREE.Color).multiplyScalar(finalOpacity); 

        let mesh: THREE.InstancedMesh<any, THREE.MeshBasicMaterial> | undefined, idx;
 if (instance.type === 'circle' && circleIdx < MAX_SHAPE_INSTANCES) { mesh = circleInstancedMesh; idx = circleIdx++; }
        else if (instance.type === 'square' && squareIdx < MAX_SHAPE_INSTANCES) { mesh = squareInstancedMesh; idx = squareIdx++; }
        else if (instance.type === 'triangle' && triangleIdx < MAX_SHAPE_INSTANCES) { mesh = triangleInstancedMesh; idx = triangleIdx++; }
        
        if (mesh && typeof idx !== 'undefined') {
          mesh.setMatrixAt(idx, dummy!.matrix);
          mesh.setColorAt(idx, tempColor!);
        }
      }
      webGLAssets.activeInstances = newActiveInstances;

      circleInstancedMesh!.count = circleIdx;
 squareInstancedMesh.count = squareIdx; // Ensure these are not potentially undefined
      triangleInstancedMesh.count = triangleIdx;
      
      if (circleIdx > 0) { if (circleInstancedMesh!.instanceMatrix) circleInstancedMesh!.instanceMatrix.needsUpdate = true; if (circleInstancedMesh!.instanceColor) circleInstancedMesh!.instanceColor!.needsUpdate = true; }
      if (squareIdx > 0) { if (squareInstancedMesh!.instanceMatrix) squareInstancedMesh!.instanceMatrix.needsUpdate = true; if (squareInstancedMesh!.instanceColor) squareInstancedMesh!.instanceColor!.needsUpdate = true; }
      if (triangleIdx > 0) { if (triangleInstancedMesh!.instanceMatrix) triangleInstancedMesh!.instanceMatrix.needsUpdate = true; if (triangleInstancedMesh!.instanceColor) triangleInstancedMesh!.instanceColor!.needsUpdate = true; }
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.scene?.remove(webGLAssets.starfieldMesh!);
      webGLAssets.starfieldMesh?.geometry?.dispose();
      webGLAssets.starfieldMaterial?.dispose();

      [webGLAssets.circleInstancedMesh, webGLAssets.squareInstancedMesh, webGLAssets.triangleInstancedMesh].forEach(mesh => {
        if (mesh) {
          webGLAssets.scene?.remove(mesh);
          // Geometry and material are shared, dispose them once
        }
      });
      if (webGLAssets.shapeGeometries) {
        Object.values(webGLAssets.shapeGeometries).forEach(geom => geom.dispose());
      }
      webGLAssets.shapeMaterial?.dispose();
      webGLAssets.activeInstances = [];
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    displayLabel: 'FINALE',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HEX_COLORS.black}/${SBNF_HEX_COLORS.orangeYellow}.png?text=FINALE&font=poppins`,
    dataAiHint: 'cosmic explosion stars fireworks',
 initWebGL: (canvas) => {
      const scene = new THREE.Scene(); // No unused warning
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 300; 

      const PARTICLE_COUNT = 3000; 
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT);
      const initialLifetimes = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes[i] = 0; 
        const pIdx = i * 3;
        positions[pIdx + 1] = 10000; 
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 2.0, vertexColors: true, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false,
      });
      const particles = new THREE.Points(geometry, particleMaterial);
      scene.add(particles); // No unused warning
      
      return {
        scene, camera, particles, particleMaterial, particleGeometry: geometry,
        positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT,
        lastBeatTime: 0, lastFrameTimeWebGL: performance.now(),
        tempColor: new THREE.Color(), bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black/360, 0, 0.01),
        rotationSpeed: new THREE.Vector3(0.005, 0.007, 0.002),
      } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets?.particles || !webGLAssets.particleMaterial || !webGLAssets.particleGeometry) return;
 const { particles, particleMaterial, particleGeometry, positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT, tempColor, bgColor, rotationSpeed } = webGLAssets as WebGLSceneAssets & { particles: THREE.Points, particleMaterial: THREE.PointsMaterial, particleGeometry: THREE.BufferGeometry, positions: Float32Array, colors: Float32Array, velocities: Float32Array, lifetimes: Float32Array, initialLifetimes: Float32Array, PARTICLE_COUNT: number, tempColor: THREE.Color, bgColor: THREE.Color, rotationSpeed: THREE.Vector3, lastBeatTime: number, lastFrameTimeWebGL: number };
      
      webGLAssets.lastFrameTimeWebGL = webGLAssets.lastFrameTimeWebGL || performance.now();
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      renderer.setClearColor(bgColor.getHex(), 0.12); 

      const BEAT_COOLDOWN = 90; 
      const DRAG_FACTOR = 0.975; 
      const SBNF_FINALE_HUES = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      if (audioData.beat && currentTime - webGLAssets.lastBeatTime > BEAT_COOLDOWN) {
        webGLAssets.lastBeatTime = currentTime;
        let spawnedThisBeat = 0;
        const particlesToSpawn = Math.floor(PARTICLE_COUNT * 0.20); 

        for (let i = 0; i < PARTICLE_COUNT && spawnedThisBeat < particlesToSpawn; i++) {
          if (lifetimes[i] <= 0) { 
            const pIdx = i * 3;
            positions[pIdx] = (Math.random() - 0.5) * 10; positions[pIdx+1] = (Math.random() - 0.5) * 10; positions[pIdx+2] = (Math.random() - 0.5) * 10; 
            
            const phi = Math.random() * Math.PI * 2; const theta = Math.acos(Math.random() * 2 - 1);
            const speed = 160 + (audioData.rms + audioData.bassEnergy * 1.1) * 260 * (0.6 + Math.random() * 0.5); 
            velocities[pIdx] = Math.sin(theta) * Math.cos(phi) * speed;
            velocities[pIdx+1] = Math.sin(theta) * Math.sin(phi) * speed;
            velocities[pIdx+2] = Math.cos(theta) * speed;
            
            const life = 1.4 + Math.random() * 1.8; 
            lifetimes[i] = life; initialLifetimes[i] = life;
            
            const hue = SBNF_FINALE_HUES[Math.floor(Math.random() * SBNF_FINALE_HUES.length)];
            const baseLightness = 40 + Math.random() * 20; 
            const lightnessVariation = (audioData.beat ? 10 : 0) + (audioData.rms * 10);
            const finalLightness = Math.min(70, baseLightness + lightnessVariation); 
            const [r,g,bVal] = hslToRgb(hue, 90 + Math.random() * 10, finalLightness);
            tempColor.setRGB(r,g,bVal);
            colors[pIdx] = tempColor.r; colors[pIdx+1] = tempColor.g; colors[pIdx+2] = tempColor.b;
            spawnedThisBeat++;
          }
        }
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (lifetimes[i] > 0) {
          const pIdx = i * 3;
          positions[pIdx] += velocities[pIdx] * deltaTime;
          positions[pIdx+1] += velocities[pIdx+1] * deltaTime;
          positions[pIdx+2] += velocities[pIdx+2] * deltaTime;
          velocities[pIdx] *= DRAG_FACTOR; velocities[pIdx+1] *= DRAG_FACTOR; velocities[pIdx+2] *= DRAG_FACTOR;
          
          lifetimes[i] -= deltaTime;
          const lifeRatio = Math.max(0, lifetimes[i] / initialLifetimes[i]);
          const fadeFactor = Math.pow(lifeRatio, 0.55); 
          
          colors[pIdx] *= fadeFactor; 
          colors[pIdx+1] *= fadeFactor;
          colors[pIdx+2] *= fadeFactor;

          if (lifetimes[i] <= 0) {
            positions[pIdx+1] = 10000; 
            colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0;
          }
        }
      }

 particleGeometry.attributes.position.needsUpdate = true; // No unused warning
      particleGeometry.attributes.color.needsUpdate = true;

      particleMaterial.size = Math.max(0.8, (1.5 + audioData.rms * 2.8) * Math.max(0.1, settings.brightCap)); 
      particleMaterial.opacity = Math.max(0.1, settings.brightCap * (0.28 + audioData.rms * 0.38)); 

      particles.rotation.x += rotationSpeed.x * deltaTime * (0.1 + audioData.midEnergy * 0.3);
      particles.rotation.y += rotationSpeed.y * deltaTime * (0.1 + audioData.trebleEnergy * 0.3);

      const cam = camera as THREE.PerspectiveCamera;
      cam.fov = THREE.MathUtils.clamp(75 + audioData.rms * 0.5 - (audioData.beat ? 2 : 0), 72, 78); 
      cam.position.z = 300 - audioData.rms * 50; 
      cam.updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.scene?.remove(webGLAssets.particles!);
      webGLAssets.particleGeometry?.dispose();
      webGLAssets.particleMaterial?.dispose();
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    displayLabel: 'GRID',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HEX_COLORS.lightLavender}/${SBNF_HEX_COLORS.deepPurple}.png?text=GRID&font=poppins`,
    dataAiHint: 'neon grid pulse audio frequency',
 initWebGL: (canvas) => {
      const scene = new THREE.Scene(); // No unused warning
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const GRID_SIZE_X = 16;
      let GRID_SIZE_Y = Math.round(GRID_SIZE_X * (canvas.height / canvas.width)) || 1;
      let totalCells = GRID_SIZE_X * GRID_SIZE_Y;

      let cellBaseWidth = canvas.width / GRID_SIZE_X;
      let cellBaseHeight = canvas.height / GRID_SIZE_Y;
      const cellGeometry = new THREE.PlaneGeometry(cellBaseWidth * 0.85, cellBaseHeight * 0.85); 
      
      const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, totalCells);
      scene.add(instancedMesh); // No unused warning
      
      const dummy = new THREE.Object3D();
      const cellStates: { currentColor: THREE.Color; targetColor: THREE.Color; currentScale: number; targetScale: number; }[] = [];
      const dimColor = new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple/360, 0.5, 0.1);

      for (let y = 0; y < GRID_SIZE_Y; y++) {
        for (let x = 0; x < GRID_SIZE_X; x++) {
          const idx = y * GRID_SIZE_X + x;
          dummy.position.set((x - GRID_SIZE_X / 2 + 0.5) * cellBaseWidth, (y - GRID_SIZE_Y / 2 + 0.5) * cellBaseHeight, 0);
          dummy.scale.set(1,1,1);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(idx, dummy.matrix);
          instancedMesh.setColorAt(idx, dimColor);
          cellStates.push({ currentColor: dimColor.clone(), targetColor: dimColor.clone(), currentScale: 1, targetScale: 1 });
        }
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
      
      return {
        scene, camera, instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellBaseWidth, cellBaseHeight, cellStates,
        dummy, tempColor: new THREE.Color(), bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black/360, 0, 0.02),
        lastFrameTimeWebGL: performance.now(),
        lastCanvasWidth: canvas.width,
        lastCanvasHeight: canvas.height,
      } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
 if (!webGLAssets?.instancedMesh || !webGLAssets.cellStates || !webGLAssets.dummy || !webGLAssets.tempColor || !webGLAssets.bgColor) return; // Ensure all necessary properties are checked
      let { instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellStates, dummy, tempColor, bgColor, cellBaseWidth, cellBaseHeight } = webGLAssets as any;

      const currentTime = performance.now();
      webGLAssets.lastFrameTimeWebGL = webGLAssets.lastFrameTimeWebGL ?? currentTime; // Use nullish coalescing
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL!) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      renderer.setClearColor(bgColor.getHex(), 0.2); 

      const spectrum = audioData.spectrum;
      const spectrumLength = spectrum.length;
      const HUE_PALETTE = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];
      const hueTimeShift = (currentTime / 30000) * 360; 

      if (canvasWidth !== webGLAssets.lastCanvasWidth || canvasHeight !== webGLAssets.lastCanvasHeight) {
        webGLAssets.lastCanvasWidth = canvasWidth;
        webGLAssets.lastCanvasHeight = canvasHeight;
        
        GRID_SIZE_Y = Math.round(GRID_SIZE_X * (canvasHeight / canvasWidth)) || 1;
        totalCells = GRID_SIZE_X * GRID_SIZE_Y;
        cellBaseWidth = canvasWidth / GRID_SIZE_X;
        cellBaseHeight = canvasHeight / GRID_SIZE_Y;

        
        if (instancedMesh.geometry) instancedMesh.geometry.dispose();
        instancedMesh.geometry = new THREE.PlaneGeometry(cellBaseWidth * 0.85, cellBaseHeight * 0.85);
        
        
        if (cellStates.length !== totalCells || instancedMesh.count !== totalCells) {
            scene.remove(instancedMesh);
            instancedMesh.dispose(); 
            const newInstancedMesh = new THREE.InstancedMesh(instancedMesh.geometry, instancedMesh.material as THREE.Material, totalCells);
            instancedMesh = newInstancedMesh;
            scene.add(instancedMesh);
            webGLAssets.instancedMesh = instancedMesh; 

            cellStates.length = 0;
            const dimColor = new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple/360, 0.5, 0.1);
             for (let y = 0; y < GRID_SIZE_Y; y++) {
                for (let x = 0; x < GRID_SIZE_X; x++) {
                    const idx = y * GRID_SIZE_X + x;
                    dummy.position.set((x - GRID_SIZE_X / 2 + 0.5) * cellBaseWidth, (y - GRID_SIZE_Y / 2 + 0.5) * cellBaseHeight, 0);
                    dummy.scale.set(1,1,1);
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(idx, dummy.matrix);
                    instancedMesh.setColorAt(idx, dimColor);
                    cellStates.push({ currentColor: dimColor.clone(), targetColor: dimColor.clone(), currentScale: 1, targetScale: 1 });
                }
            }
        } else {
             for (let y = 0; y < GRID_SIZE_Y; y++) {
                for (let x = 0; x < GRID_SIZE_X; x++) {
                    const idx = y * GRID_SIZE_X + x;
                    dummy.position.set((x - GRID_SIZE_X / 2 + 0.5) * cellBaseWidth, (y - GRID_SIZE_Y / 2 + 0.5) * cellBaseHeight, 0);
                    const currentScale = cellStates[idx].currentScale; 
                    dummy.scale.set(currentScale,currentScale,currentScale);
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(idx, dummy.matrix);
                }
            }
        }
        webGLAssets.GRID_SIZE_Y = GRID_SIZE_Y;
        webGLAssets.totalCells = totalCells;
        webGLAssets.cellBaseWidth = cellBaseWidth;
        webGLAssets.cellBaseHeight = cellBaseHeight;
      }


      for (let y = 0; y < GRID_SIZE_Y; y++) {
        for (let x = 0; x < GRID_SIZE_X; x++) {
          const idx = y * GRID_SIZE_X + x;
          if (idx >= totalCells || !cellStates[idx]) continue; 
          const cell = cellStates[idx];
          const specIdx = Math.floor((idx / totalCells) * spectrumLength);
          const energy = (spectrum[specIdx] || 0) / 255;

          const baseHue = HUE_PALETTE[((x + y) % 3 + Math.floor(currentTime / 5000)) % HUE_PALETTE.length];
          const hue = (baseHue + energy * 50 + (audioData.beat ? 30 : 0) + hueTimeShift) % 360;
          const sat = 0.65 + energy * 0.3;
          const light = Math.min(0.7, 0.15 + energy * 0.55 * settings.brightCap + (audioData.beat ? 0.1 : 0));
          const [r, g, bVal] = hslToRgb(hue, sat * 100, light * 100);
          cell.targetColor.setRGB(r, g, bVal);
          cell.currentColor.lerp(cell.targetColor, 0.12 + deltaTime * 2.0); 
          instancedMesh.setColorAt(idx, cell.currentColor);

          cell.targetScale = 1 + energy * 0.25 + (audioData.beat ? 0.15 : 0) * audioData.rms * 1.5;
          cell.currentScale += (cell.targetScale - cell.currentScale) * (0.1 + deltaTime * 3.0); 

          instancedMesh.getMatrixAt(idx, dummy.matrix);
          const currentPosition = new THREE.Vector3().setFromMatrixPosition(dummy.matrix);
          dummy.position.copy(currentPosition);
          dummy.scale.set(cell.currentScale, cell.currentScale, 1);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(idx, dummy.matrix);
        }
      }
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
      if (instancedMesh.instanceMatrix) instancedMesh.instanceMatrix.needsUpdate = true;

    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.scene?.remove(webGLAssets.instancedMesh!);
      webGLAssets.instancedMesh?.geometry?.dispose();
      (webGLAssets.instancedMesh?.material as THREE.Material)?.dispose();
      webGLAssets.cellStates = [];
    },
  },
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    displayLabel: 'MIRROR',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HEX_COLORS.deepPurple}/${SBNF_HEX_COLORS.lightPeach}.png?text=MIRROR&font=poppins`,
    dataAiHint: 'webcam silhouette performer',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene(); // No unused warning
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000); // No unused warning
      camera.position.z = 1;

      const webGLAssets: Partial<WebGLSceneAssets> & {
        lastCanvasWidth?: number;
        lastCanvasHeight?: number;
        noiseTexture?: THREE.DataTexture;
        vinesData?: {
          activeVines: ProceduralVine[];
          nextVineId: number;
 lastSpawnTime: number;
          spawnCooldown: number;
 maxVines: number; // No unused warning
        };
        grapesData?: {
          activeGrapes: any[];
          nextGrapeId: number;
          lastGrapeSpawnTime: number;
          spawnCooldown: number;
          maxGrapes: number;
          grapeGeometry?: THREE.BufferGeometry;
          grapeBaseMaterial?: THREE.PointsMaterial;
          grapePoints?: THREE.Points;
          grapePositions?: Float32Array;
          grapeColors?: Float32Array;
          grapeCurrentSizes?: Float32Array;
          grapeTargetSizes?: Float32Array;
          grapeLifetimes?: Float32Array;
          grapeSpawnTimes?: Float32Array;
          GRAPE_PARTICLE_COUNT_PER_CLUSTER?: number;
        };
        tempColor?: THREE.Color;
      } = {
        scene,
        camera,
        lastCanvasWidth: 0,
        lastCanvasHeight: 0,
        noiseTexture: generateNoiseTexture(256, 256) as THREE.DataTexture, // Cast if necessary
        vinesData: {
 activeVines: [],
          nextVineId: 0,
          lastSpawnTime: 0,
          spawnCooldown: 200, // ms
          maxVines: 15,
        }, // No unused warning
        grapesData: {
          activeGrapes: [],
 nextGrapeId: 0,
          lastGrapeSpawnTime: 0,
          spawnCooldown: 150,
          maxGrapes: 50, // Max visible grape clusters
          GRAPE_PARTICLE_COUNT_PER_CLUSTER: 200, // Particles per grape cluster // Unused - removed
        },
        tempColor: new THREE.Color(),
      };

      if (webcamElement && webcamElement.readyState >= HTMLMediaElement.HAVE_METADATA && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0) {
        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.NearestFilter;
        videoTexture.magFilter = THREE.NearestFilter;
        videoTexture.generateMipmaps = false;

        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);

        const vertexShader = `
          varying vec2 vUv;
          uniform bool mirrorX_bool;
          void main() {
            vUv = uv;
            if (mirrorX_bool) {
              vUv.x = 1.0 - vUv.x;
            }
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `;

        const fragmentShader = `
          uniform sampler2D webcamTexture;
          uniform sampler2D noiseTexture;
          uniform float time;
          uniform vec3 rimColor;
          uniform vec3 fillColor1;
          uniform vec3 fillColor2;
          uniform float opacityFactor; // Overall opacity controlled by JS
          varying vec2 vUv;

          float luma(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
          }

          float fresnel(vec2 texCoord, float rimWidth) {
            vec2 centeredCoord = texCoord * 2.0 - 1.0; // -1 to 1
            float distFromEdge = 1.0 - length(centeredCoord);
            return smoothstep(0.0, rimWidth, distFromEdge);
          }

          void main() {
            // Checkerboard discard for performance
            if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard;

            vec4 webcamColor = texture2D(webcamTexture, vUv);
            float webcamLuma = luma(webcamColor.rgb);
            
            // Silhouette mask based on webcam luma (softened)
            float silhouetteMask = smoothstep(0.3, 0.6, webcamLuma) * webcamColor.a;

            // Fresnel rim calculation
            float fresnelFactor = fresnel(vUv, 0.1); // 0.1 for a relatively thin rim

            // Scrolling noise for nebula fill
            vec2 noiseUV = vUv + vec2(time * 0.02, time * 0.01);
            vec3 noiseVal = texture2D(noiseTexture, noiseUV).rgb;
            vec3 nebulaColor = mix(fillColor1, fillColor2, noiseVal.r); // Mix SBNF purples/blues

            // Combine elements
            vec3 finalColor = vec3(0.0);
            float finalAlpha = 0.0;

            // Apply nebula fill inside the silhouette
            finalColor = mix(finalColor, nebulaColor, silhouetteMask);
            finalAlpha = mix(finalAlpha, silhouetteMask, silhouetteMask); // Use mask for alpha too

            // Add rim glow
            finalColor += rimColor * fresnelFactor * (1.0 + silhouetteMask * 0.5); // Rim is brighter where silhouette is
            finalAlpha = max(finalAlpha, fresnelFactor * 0.7); // Rim contributes to alpha

            // Apply overall opacityFactor from JS and compensate for discard
            finalAlpha *= opacityFactor * 1.85; 
            
            gl_FragColor = vec4(finalColor, clamp(finalAlpha, 0.0, 1.0));
          }
        `;

        const shaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            webcamTexture: { value: videoTexture },
            noiseTexture: { value: webGLAssets.noiseTexture },
            time: { value: 0.0 },
            rimColor: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.lightLavender / 360, 0.9, 0.7) },
            fillColor1: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.7, 0.4) },
            fillColor2: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.tronBlue / 360, 0.8, 0.5) },
            opacityFactor: { value: 0.8 }, 
            mirrorX_bool: { value: settings.mirrorWebcam },
          },
          vertexShader,
          fragmentShader,
          transparent: true,
          depthWrite: false, 
        });

        const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        webGLAssets.videoTexture = videoTexture; // Used in drawWebGL
        webGLAssets.planeMesh = planeMesh;
        webGLAssets.shaderMaterial = shaderMaterial;
      } else { // No unused warning
        webGLAssets.bgColor = new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.1); 
      }

      if (webGLAssets.grapesData) {
 const GRAPE_COUNT = 200; // No unused warning
        webGLAssets.grapesData.grapePositions = new Float32Array(GRAPE_COUNT * 3);
        webGLAssets.grapesData.grapeColors = new Float32Array(GRAPE_COUNT * 3);
        webGLAssets.grapesData.grapeCurrentSizes = new Float32Array(GRAPE_COUNT);
        webGLAssets.grapesData.grapeTargetSizes = new Float32Array(GRAPE_COUNT); 
        webGLAssets.grapesData.grapeLifetimes = new Float32Array(GRAPE_COUNT);
        webGLAssets.grapesData.grapeSpawnTimes = new Float32Array(GRAPE_COUNT);

        for (let i = 0; i < GRAPE_COUNT; i++) {
          webGLAssets.grapesData.grapeLifetimes[i] = 0; 
          const pIdx = i * 3;
          webGLAssets.grapesData.grapePositions[pIdx + 1] = 10000; 
        }

        webGLAssets.grapesData.grapeGeometry = new THREE.BufferGeometry();
        webGLAssets.grapesData.grapeGeometry.setAttribute('position', new THREE.BufferAttribute(webGLAssets.grapesData.grapePositions, 3));
        webGLAssets.grapesData.grapeGeometry.setAttribute('color', new THREE.BufferAttribute(webGLAssets.grapesData.grapeColors, 3));
        webGLAssets.grapesData.grapeGeometry.setAttribute('size', new THREE.BufferAttribute(webGLAssets.grapesData.grapeCurrentSizes, 1));

        webGLAssets.grapesData.grapeBaseMaterial = new THREE.PointsMaterial({
          vertexColors: true,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        webGLAssets.grapesData.grapePoints = new THREE.Points(webGLAssets.grapesData.grapeGeometry, webGLAssets.grapesData.grapeBaseMaterial);
        scene.add(webGLAssets.grapesData.grapePoints); // No unused warning
      } // No unused warning
      
      webGLAssets.lastFrameTimeWebGL = performance.now();
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight, webcamElement }) => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (webGLAssets.bgColor) {
        renderer.setClearColor(webGLAssets.bgColor, 1);
 renderer.clear();
      }

      if (webGLAssets.shaderMaterial && webGLAssets.videoTexture) {
        if (webcamElement && webcamElement.readyState >= HTMLMediaElement.HAVE_METADATA && webcamElement.videoWidth > 0) {
          webGLAssets.videoTexture.needsUpdate = true;
        }
        webGLAssets.shaderMaterial.uniforms.time.value = currentTime * 0.001;
        webGLAssets.shaderMaterial.uniforms.mirrorX_bool.value = settings.mirrorWebcam;
        
        const baseHue = (SBNF_HUES_SCENE.deepPurple + (currentTime * 0.01)) % 360;
        const rimHue = (SBNF_HUES_SCENE.lightLavender + audioData.trebleEnergy * 60) % 360;
        
        webGLAssets.shaderMaterial.uniforms.rimColor.value.setHSL(rimHue / 360, 0.9, 0.6 + audioData.trebleEnergy * 0.2);
        webGLAssets.shaderMaterial.uniforms.fillColor1.value.setHSL(baseHue / 360, 0.6, 0.3 + audioData.midEnergy * 0.2);
        webGLAssets.shaderMaterial.uniforms.fillColor2.value.setHSL((baseHue + 30) / 360, 0.7, 0.4 + audioData.bassEnergy * 0.2);
        webGLAssets.shaderMaterial.uniforms.opacityFactor.value = Math.min(1.0, settings.brightCap * (0.6 + audioData.rms * 0.4));

        if (webGLAssets.planeMesh && (canvasWidth !== webGLAssets.lastCanvasWidth || canvasHeight !== webGLAssets.lastCanvasHeight)) {
          webGLAssets.planeMesh.geometry.dispose();
          webGLAssets.planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
          webGLAssets.lastCanvasWidth = canvasWidth;
          webGLAssets.lastCanvasHeight = canvasHeight;
        }
      }

      if (webGLAssets.vinesData) {
 const { activeVines, spawnCooldown, maxVines, nextVineId } = webGLAssets.vinesData;
        if (audioData.midEnergy > 0.3 && currentTime - webGLAssets.vinesData.lastSpawnTime > spawnCooldown && activeVines.length < maxVines) {
          webGLAssets.vinesData.lastSpawnTime = currentTime;
          const edge = Math.floor(Math.random() * 4);
          let startX = 0, startY = 0, startAngle = 0;
          if (edge === 0) { startX = 0; startY = Math.random() * canvasHeight; startAngle = 0; }
          else if (edge === 1) { startX = canvasWidth; startY = Math.random() * canvasHeight; startAngle = Math.PI; }
          else if (edge === 2) { startX = Math.random() * canvasWidth; startY = 0; startAngle = Math.PI / 2; }
          else { startX = Math.random() * canvasWidth; startY = canvasHeight; startAngle = -Math.PI / 2; }

          activeVines.push({
            id: nextVineId,
            points: [{ x: startX, y: startY }],
            color: `hsla(${(SBNF_HUES_SCENE.lightLavender + Math.random() * 40 - 20)}, 80%, 70%, 0.7)`,
            opacity: 0.6 + Math.random() * 0.3,
            currentLength: 0,
            maxLength: 60 + Math.random() * 120,
            spawnTime: currentTime,
            lifetime: 4000 + Math.random() * 5000,
            thickness: 1.5 + Math.random() * 2,
            curlFactor: 0.04 + Math.random() * 0.08,
            angle: startAngle + (Math.random() - 0.5) * (Math.PI / 3.5),
            startX, startY, speed: 0.6 + Math.random() * 1.2,
          });
 webGLAssets.vinesData.nextVineId++; // No unused warning
        }

        for (let i = activeVines.length - 1; i >= 0; i--) {
          const vine = activeVines[i];
          const age = currentTime - vine.spawnTime;
          const lifeRatio = age / vine.lifetime;
          if (lifeRatio >= 1 || vine.opacity <= 0.01) {
            activeVines.splice(i, 1);
            continue;
          }
          vine.opacity = (1.0 - lifeRatio) * 0.9;
          if (vine.currentLength < vine.maxLength) {
            const last = vine.points[vine.points.length - 1];
            const t = currentTime * 0.001;
            const angleChange = (Math.sin(t * vine.curlFactor + vine.id * 0.5) + Math.sin(t * 0.3 + vine.id) + Math.sin(t * 1.1 * vine.curlFactor + vine.id) + Math.sin(t * 2.1 * vine.curlFactor + vine.id * 0.3)) * 0.09;
            vine.angle += angleChange * deltaTime * 60; 
            const segLen = (vine.speed + audioData.midEnergy * 3) * (1 + audioData.midEnergy * 0.5) * deltaTime * 30; 
            const newX = last.x + Math.cos(vine.angle) * segLen;
            const newY = last.y + Math.sin(vine.angle) * segLen;
            if (newX >= 0 && newX <= canvasWidth && newY >= 0 && newY <= canvasHeight) {
              vine.points.push({ x: newX, y: newY });
              vine.currentLength++;
            } else {
              vine.currentLength = vine.maxLength;
            }
          }
        }
      }

      if (webGLAssets.grapesData && webGLAssets.grapesData.grapePoints) {
        const gd = webGLAssets.grapesData as { grapePositions: Float32Array, grapeColors: Float32Array, grapeCurrentSizes: Float32Array, grapeTargetSizes: Float32Array, grapeLifetimes: Float32Array, grapeSpawnTimes: Float32Array, grapeGeometry: THREE.BufferGeometry, grapeBaseMaterial: THREE.PointsMaterial, lastGrapeSpawnTime: number, spawnCooldown: number };
        const positions = gd.grapePositions!;
        const colors = gd.grapeColors!;
        const currentSizes = gd.grapeCurrentSizes!;
        const targetSizes = gd.grapeTargetSizes!;
        const lifetimes = gd.grapeLifetimes!;
        const spawnTimes = gd.grapeSpawnTimes!;
        
        if (audioData.beat && currentTime - gd.lastGrapeSpawnTime > gd.spawnCooldown) {
          gd.lastGrapeSpawnTime = currentTime;
          let spawnedThisBeat = 0;
          const numToSpawn = 5 + Math.floor(audioData.bassEnergy * 15);
          for (let i = 0; i < 200 && spawnedThisBeat < numToSpawn; i++) {
            if (lifetimes[i] <= 0) {
              const pIdx = i * 3;
              positions[pIdx] = (Math.random() - 0.5) * canvasWidth * 0.7;
              positions[pIdx + 1] = (Math.random() - 0.5) * canvasHeight * 0.7;
              positions[pIdx + 2] = (Math.random() - 0.5) * 50;
              
              lifetimes[i] = 1.5 + Math.random() * 1.5;
 spawnTimes[i] = currentTime; // No unused warning
              targetSizes[i] = (15 + audioData.bassEnergy * 30) * settings.brightCap;
              currentSizes[i] = targetSizes[i] * 0.1; 

              const initialHue = SBNF_HUES_SCENE.lightLavender;
              webGLAssets.tempColor!.setHSL(initialHue / 360, 0.9, 0.7);
              colors[pIdx] = webGLAssets.tempColor!.r;
              colors[pIdx + 1] = webGLAssets.tempColor!.g;
              colors[pIdx + 2] = webGLAssets.tempColor!.b;
              spawnedThisBeat++;
            }
          }
        }

        for (let i = 0; i < 200; i++) {
          if (lifetimes[i] > 0) {
            const age = currentTime - spawnTimes[i];
            const lifeRatio = Math.min(1, age / (lifetimes[i] * 1000)); 

            const ripenHue = SBNF_HUES_SCENE.orangeRed;
            const startHue = SBNF_HUES_SCENE.lightLavender;
            const currentHue = startHue + (ripenHue - startHue) * lifeRatio;
            webGLAssets.tempColor!.setHSL(currentHue / 360, 0.9, 0.6 + lifeRatio * 0.1);
            const cIdx = i * 3;
            colors[cIdx] = webGLAssets.tempColor!.r;
            colors[cIdx + 1] = webGLAssets.tempColor!.g;
            colors[cIdx + 2] = webGLAssets.tempColor!.b;

            const sizeProgress = Math.sin(lifeRatio * Math.PI); 
            currentSizes[i] = targetSizes[i] * sizeProgress;
            
            if (lifeRatio > 0.8) {
                currentSizes[i] *= (1.0 - (lifeRatio - 0.8) / 0.2);
            }
            currentSizes[i] = Math.max(0, currentSizes[i]);

            lifetimes[i] -= deltaTime;
            if (lifetimes[i] <= 0) {
              currentSizes[i] = 0; 
              const pIdx = i*3;
              positions[pIdx+1] = 10000; 
            }
          }
        }
        if (gd.grapeGeometry) {
          gd.grapeGeometry.attributes.position.needsUpdate = true;
          gd.grapeGeometry.attributes.color.needsUpdate = true;
          gd.grapeGeometry.attributes.size.needsUpdate = true;
        }
        if (gd.grapeBaseMaterial) {
            gd.grapeBaseMaterial.opacity = Math.min(0.9, 0.5 + settings.brightCap * 0.4 + audioData.rms * 0.3);
        }
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets.videoTexture) webGLAssets.videoTexture.dispose();
      if (webGLAssets.planeMesh) {
        webGLAssets.planeMesh.geometry?.dispose();
        (Array.isArray(webGLAssets.planeMesh.material) ? webGLAssets.planeMesh.material : [webGLAssets.planeMesh.material]).forEach(m => m?.dispose());
      }
      if (webGLAssets.shaderMaterial) webGLAssets.shaderMaterial.dispose();
      if (webGLAssets.noiseTexture) webGLAssets.noiseTexture.dispose();
      if (webGLAssets.vinesData) webGLAssets.vinesData.activeVines = [];

      if (webGLAssets.grapesData) {
        if (webGLAssets.grapesData.grapePoints) webGLAssets.scene?.remove(webGLAssets.grapesData.grapePoints);
        webGLAssets.grapesData.grapeGeometry?.dispose();
        webGLAssets.grapesData.grapeBaseMaterial?.dispose();
        webGLAssets.grapesData.activeGrapes = [];
      }
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    displayLabel: 'RINGS',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HEX_COLORS.deepPurple}/${SBNF_HEX_COLORS.tronBlue}.png?text=RINGS&font=poppins`,
 dataAiHint: 'concentric rings audio frequency',
 initWebGL: (canvas) => {
      const scene = new THREE.Scene(); // No unused warning
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
 camera.position.z = 1;

      const ringGeometry = new THREE.RingGeometry(0.48, 0.5, 64); 

      return {
        scene,
        camera,
        ringGeometry, // Used in drawWebGL
        activeRings: [],
        lastSpawnTimes: { bass: 0, mid: 0, treble: 0 },
        spawnCooldown: 50, 
        maxRingsPerBand: 15,
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
      } as WebGLSceneAssets & {
        ringGeometry: THREE.RingGeometry;
        activeRings: Array<{
          mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
          spawnTime: number;
          lifetime: number;
          initialOpacity: number;
          maxScale: number;
          band: 'bass' | 'mid' | 'treble';
        }>;
        lastSpawnTimes: Record<'bass'|'mid'|'treble', number>;
        spawnCooldown: number;
        maxRingsPerBand: number;
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const now = performance.now();
 webGLAssets.lastFrameTimeWebGL = webGLAssets.lastFrameTimeWebGL || now; // Initialize if undefined
 const deltaTime = (now - webGLAssets.lastFrameTimeWebGL!) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = now;

      const { ringGeometry, activeRings, lastSpawnTimes, spawnCooldown, maxRingsPerBand, tempColor } = webGLAssets as WebGLSceneAssets & { ringGeometry: THREE.RingGeometry, activeRings: any[], lastSpawnTimes: Record<'bass'|'mid'|'treble', number>, spawnCooldown: number, maxRingsPerBand: number, tempColor: THREE.Color };

      renderer.setClearColor(new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.02), 0.15); 

      const RING_COLORS_HSL = {
        bass: { h: SBNF_HUES_SCENE.orangeRed, s: 0.95, l: 0.55 },
        mid: { h: SBNF_HUES_SCENE.orangeYellow, s: 0.90, l: 0.60 },
        treble: { h: SBNF_HUES_SCENE.lightLavender, s: 0.85, l: 0.65 },
      };

      const trySpawn = (band: 'bass' | 'mid' | 'treble', energy: number) => {
        if (energy > 0.08 && now - lastSpawnTimes[band] > spawnCooldown && activeRings.filter((r: any) => r.band === band).length < maxRingsPerBand) {
 lastSpawnTimes[band] = now;
          
          const baseColorConf = RING_COLORS_HSL[band];
          tempColor.setHSL(baseColorConf.h / 360, baseColorConf.s, baseColorConf.l * (0.7 + energy * 0.5));
          
          const material = new THREE.MeshBasicMaterial({
            color: tempColor.clone(),
            opacity: Math.min(0.85, 0.4 + energy * 0.55) * settings.brightCap,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(ringGeometry, material);
          mesh.scale.set(canvasWidth * 0.03, canvasWidth * 0.03, 1);
          scene.add(mesh); // No unused warning
          activeRings.push({
            mesh, spawnTime: now, lifetime: 800 + energy * 1200,
            initialOpacity: material.opacity, maxScale: canvasWidth * (0.7 + energy * 0.5), band
          });
        }
      };

      trySpawn('bass', audioData.bassEnergy);
      trySpawn('mid', audioData.midEnergy);
      trySpawn('treble', audioData.trebleEnergy);

      for (let i = activeRings.length - 1; i >= 0; --i) {
        const r = activeRings[i] as { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; spawnTime: number; lifetime: number; initialOpacity: number; maxScale: number; band: 'bass' | 'mid' | 'treble'; };
        const age = now - r.spawnTime;
        const t = Math.min(1, age / r.lifetime);
        if (t >= 1) {
 scene.remove(r.mesh); // No unused warning
          (r.mesh.material as THREE.Material).dispose();
          activeRings.splice(i, 1);
          continue;
        }
        const scale = canvasWidth * 0.03 + t * r.maxScale * (1 - Math.pow(t, 2)); 
        r.mesh.scale.set(scale, scale, 1);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = r.initialOpacity * (1 - Math.pow(t, 1.5)) * settings.brightCap;
      }
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.activeRings?.forEach((r: any) => {
 webGLAssets.scene?.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
      });
      webGLAssets.activeRings = [];
      webGLAssets.ringGeometry?.dispose();
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    displayLabel: 'STROBE',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HEX_COLORS.black}/${SBNF_HEX_COLORS.lightPeach}.png?text=STROBE&font=poppins`,
    dataAiHint: 'flashing light beat strobe',
 initWebGL: (canvas) => {
      const scene = new THREE.Scene(); // No unused warning
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);
      const planeMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(SBNF_HUES_SCENE.black), transparent: true, opacity: 1.0, depthWrite: false });
      const flashPlane = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(flashPlane);

      return {
        scene, camera, flashPlane, planeMaterial, tempColor: new THREE.Color(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        lastFlashTime: 0, flashActive: false, flashDuration: 50, 
        lastFrameTimeWebGL: performance.now(),
        lastCanvasWidth: canvas.width,
        lastCanvasHeight: canvas.height,
      } as WebGLSceneAssets & {
        flashPlane: THREE.Mesh; planeMaterial: THREE.MeshBasicMaterial;
 lastFlashTime: number; flashActive: boolean; flashDuration: number; // No unused warning
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets?.flashPlane || !webGLAssets.planeMaterial || !webGLAssets.tempColor || !webGLAssets.bgColor) return;
      const { flashPlane, planeMaterial, tempColor, bgColor } = webGLAssets as WebGLSceneAssets & { flashPlane: THREE.Mesh, planeMaterial: THREE.MeshBasicMaterial, tempColor: THREE.Color, bgColor: THREE.Color, lastFlashTime: number, flashActive: boolean, flashDuration: number, lastCanvasWidth: number, lastCanvasHeight: number };
      const currentTime = performance.now();

      renderer.setClearColor(bgColor.getHex(), 1.0);

      if (audioData.beat && settings.brightCap > 0.01 && currentTime - webGLAssets.lastFlashTime > webGLAssets.flashDuration * 2) { 
        webGLAssets.flashActive = true;
        webGLAssets.lastFlashTime = currentTime;
        
        const HUE_OPTIONS = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender];
        const hue = HUE_OPTIONS[Math.floor(Math.random() * HUE_OPTIONS.length)];
        const [r,g,bVal] = hslToRgb(hue, 95 + Math.random() * 5, 70 + Math.random() * 15);
        tempColor.setRGB(r,g,bVal);
        planeMaterial.color.copy(tempColor);
        planeMaterial.opacity = Math.min(1.0, settings.brightCap);
        flashPlane.visible = true;
      }

      if (webGLAssets.flashActive) {
        const elapsed = currentTime - webGLAssets.lastFlashTime;
        if (elapsed >= webGLAssets.flashDuration) {
          webGLAssets.flashActive = false;
          flashPlane.visible = false; 
        } else {
          planeMaterial.opacity = Math.min(1.0, settings.brightCap) * (1.0 - elapsed / webGLAssets.flashDuration); 
        }
      } else {
        flashPlane.visible = false;
      }
 if (canvasWidth !== webGLAssets.lastCanvasWidth || canvasHeight !== webGLAssets.lastCanvasHeight) { // Ensure these are checked
        if (flashPlane.geometry) flashPlane.geometry.dispose();
        flashPlane.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
        webGLAssets.lastCanvasWidth = canvasWidth;
        webGLAssets.lastCanvasHeight = canvasHeight;
      }
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.scene?.remove(webGLAssets.flashPlane!);
      webGLAssets.flashPlane?.geometry?.dispose();
      webGLAssets.planeMaterial?.dispose();
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    displayLabel: 'TUNNEL',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HEX_COLORS.deepPurple}/${SBNF_HEX_COLORS.orangeRed}.png?text=TUNNEL&font=poppins`,
    dataAiHint: 'geometric tunnel flight tron',
 initWebGL: (canvas) => {
      const scene = new THREE.Scene(); // No unused warning
      const cameraBaseFov = 70; // Store base FOV
      const camera = new THREE.PerspectiveCamera(cameraBaseFov, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 0;

      const NUM_SEGMENTS = 25;
      const SEGMENT_SPACING = 60;
      const SEGMENT_RADIUS = 25;
      const SEGMENT_TUBE = 1.5;

      const SBNF_TRON_HUES = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.deepPurple];
      const segmentGeometry = new THREE.TorusGeometry(SEGMENT_RADIUS, SEGMENT_TUBE, 8, 32);
      const tunnelSegments: THREE.Mesh[] = [];

      for (let i = 0; i < NUM_SEGMENTS; i++) {
        const hue = SBNF_TRON_HUES[i % SBNF_TRON_HUES.length];
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(hue / 360, 0.9, 0.6),
          wireframe: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * SEGMENT_SPACING;
        segment.rotation.x = Math.PI / 2;
        tunnelSegments.push(segment);
        scene.add(segment);
      } // No unused warning
      
      return {
        scene, camera, tunnelSegments, segmentGeometry, NUM_SEGMENTS, SEGMENT_SPACING, cameraBaseFov,
        sbnfTronHues: SBNF_TRON_HUES, tempColor: new THREE.Color(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), lastFrameTimeWebGL: performance.now(),
      } as WebGLSceneAssets & {
 tunnelSegments: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[]; // No unused warning
        segmentGeometry: THREE.TorusGeometry; 
        NUM_SEGMENTS: number; SEGMENT_SPACING: number; cameraBaseFov: number;
        sbnfTronHues: readonly number[]; tempColor: THREE.Color; bgColor: THREE.Color;
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets?.tunnelSegments || typeof webGLAssets.cameraBaseFov === 'undefined') return; // Ensure cameraBaseFov is checked
      const { tunnelSegments, NUM_SEGMENTS, SEGMENT_SPACING, cameraBaseFov, sbnfTronHues, tempColor, bgColor } = webGLAssets as WebGLSceneAssets & { tunnelSegments: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[], NUM_SEGMENTS: number, SEGMENT_SPACING: number, cameraBaseFov: number, sbnfTronHues: readonly number[], tempColor: THREE.Color, bgColor: THREE.Color, lastFrameTimeWebGL: number };
      
 webGLAssets.lastFrameTimeWebGL = webGLAssets.lastFrameTimeWebGL ?? performance.now(); // Use nullish coalescing
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      renderer.setClearColor(bgColor.getHex(), 1);

      const speed = 30 + audioData.rms * 110 + audioData.bpm * 0.07; 
      camera.position.z -= speed * deltaTime;

      tunnelSegments.forEach((segment, i: number) => {
        if (segment.position.z > camera.position.z + SEGMENT_SPACING) {
          segment.position.z -= NUM_SEGMENTS * SEGMENT_SPACING;
          segment.material.color.setHSL(sbnfTronHues[Math.floor(Math.random() * sbnfTronHues.length)] / 360, 0.9, 0.6);
        }
        const scaleFactor = 1 + Math.sin(currentTime * 0.001 + i * 0.5) * 0.1 + audioData.bassEnergy * 0.2;
        segment.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        const hueIdx = (Math.floor(currentTime * 0.0002) + i) % sbnfTronHues.length; 
        const hue = sbnfTronHues[hueIdx];
        const sat = 0.7 + audioData.midEnergy * 0.25;
        const lum = Math.min(0.7, 0.45 + audioData.trebleEnergy * 0.2 + (audioData.beat && i % 3 === 0 ? 0.12 : 0));
        segment.material.color.setHSL(hue / 360, sat, lum);
        segment.material.opacity = Math.min(0.8, 0.55 + audioData.rms * 0.35 * settings.brightCap);
        segment.rotation.z += (audioData.trebleEnergy * 0.025 + 0.001 + audioData.bpm * 0.00002) * (i % 2 === 0 ? 1.2 : -1.4) * deltaTime * 60; 
        segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0006 + i * 0.35) * audioData.midEnergy * 0.6; 
      });

      (camera as THREE.PerspectiveCamera).fov = cameraBaseFov - audioData.rms * 35 * settings.gamma + (audioData.beat ? 8 : 0) ; 
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.tunnelSegments?.forEach((seg: any) => {
        webGLAssets.scene?.remove(seg);
        seg.material.dispose();
      });
      webGLAssets.segmentGeometry?.dispose(); 
      webGLAssets.tunnelSegments = [];
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";

export function drawProceduralVines(
  ctx: CanvasRenderingContext2D,
  vines: ProceduralVine[] | undefined
) {
  if (!ctx || !vines || vines.length === 0) return;

  ctx.save();
  vines.forEach((vine) => {
    if (vine.points.length < 2 || vine.opacity <= 0.01) return;

    ctx.beginPath();
    ctx.moveTo(vine.points[0].x, vine.points[0].y);
    for (let i = 1; i < vine.points.length; i++) {
      ctx.lineTo(vine.points[i].x, vine.points[i].y);
    }

    let strokeColor = vine.color;
    if (vine.opacity < 1.0) {
      if (strokeColor.startsWith("hsl(")) {
        strokeColor = strokeColor.replace("hsl(", "hsla(").replace(")", `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith("rgb(")) {
         strokeColor = strokeColor.replace("rgb(", "rgba(").replace(")", `, ${vine.opacity.toFixed(2)})`);
      } else if (strokeColor.startsWith("#") && (strokeColor.length === 7 || strokeColor.length === 4) ) { 
        const hexToRgba = (hex: string, alpha: number) => {
            let r = 0, g = 0, b = 0;
            if (hex.length === 4) { 
                r = parseInt(hex[1] + hex[1], 16);
                g = parseInt(hex[2] + hex[2], 16);
                b = parseInt(hex[3] + hex[3], 16);
            } else if (hex.length === 7) { 
                r = parseInt(hex.slice(1, 3), 16);
                g = parseInt(hex.slice(3, 5), 16);
                b = parseInt(hex.slice(5, 7), 16);
            }
            return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
        };
        strokeColor = hexToRgba(strokeColor, vine.opacity);
      } else {
        ctx.globalAlpha = vine.opacity; 
      }
    }
    
    if (!(strokeColor.startsWith("rgba") || strokeColor.startsWith("hsla"))) {
        ctx.globalAlpha = vine.opacity; 
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(0.5, vine.thickness);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.globalAlpha = 1.0; 
  });
  ctx.restore();
}

