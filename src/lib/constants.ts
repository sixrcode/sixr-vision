
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
  // Added a Tron-like Blue for specific scenes, can be adjusted
  tronBlue: 197, // A bright cyan/blue for Tron
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
  showWebcam: false, // Default webcam to off
  mirrorWebcam: true, // Default mirror to on
  currentSceneId: 'radial_burst', // SBNF default, now WebGL
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
  aiOverlayRegenerationInterval: 45, // in seconds
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins',
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(
        canvas.width / -2, canvas.width / 2,
        canvas.height / 2, canvas.height / -2,
        1, 1000
      );
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      let videoTexture: THREE.VideoTexture | null = null;
      let planeMesh: THREE.Mesh | null = null;
      let shaderMaterial: THREE.ShaderMaterial | null = null;

      const [defaultR, defaultG, defaultB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 47);

      if (webcamElement && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0 && settings.showWebcam) {
        videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.colorSpace = THREE.SRGBColorSpace;

        const planeGeometry = new THREE.PlaneGeometry(1, 1); 
        
        shaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            webcamTexture: { value: videoTexture },
            dynamicColorVec3: { value: new THREE.Color(defaultR, defaultG, defaultB) }, 
            opacityFactor: { value: 1.0 },
            mirrorX_bool: { value: settings.mirrorWebcam },
            textureOffset: { value: new THREE.Vector2(0,0) },
            textureScale: { value: new THREE.Vector2(1,1) },
          },
          vertexShader: `
            varying vec2 vUv;
            uniform bool mirrorX_bool;
            uniform vec2 textureOffset;
            uniform vec2 textureScale;

            void main() {
              vec2 transformedUv = uv * textureScale + textureOffset;
              if (mirrorX_bool) {
                transformedUv.x = 1.0 - transformedUv.x;
              }
              vUv = transformedUv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D webcamTexture;
            uniform vec3 dynamicColorVec3; 
            uniform float opacityFactor; 
            varying vec2 vUv;

            void main() {
              vec2 clampedUv = clamp(vUv, 0.0, 1.0);
              vec4 texColor = texture2D(webcamTexture, clampedUv);
              float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
              float mask = smoothstep(0.3, 0.6, luma); 
              vec3 silhouetteColor = dynamicColorVec3 * mask; 
              
              gl_FragColor = vec4(silhouetteColor, texColor.a * mask * opacityFactor);
            }
          `,
          transparent: true,
          depthWrite: false, 
        });

        planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        planeMesh.scale.set(canvas.width, canvas.height, 1);
        scene.add(planeMesh);
        renderer.setClearColor(0x000000, 0); 
      } else {
        const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 15); 
        renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 1);
      }
      
      return { renderer, scene, camera, videoTexture, planeMesh, shaderMaterial };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.renderer) {
        if(renderer) {
          const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 10); 
          renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 1);
          renderer.clear(); 
        }
        return;
      }
  
      const { videoTexture, planeMesh, shaderMaterial } = webGLAssets;
  
      if (settings.showWebcam && videoTexture && planeMesh && shaderMaterial && webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA && webcamElement.videoWidth > 0) {
          videoTexture.needsUpdate = true; 
          planeMesh.visible = true;
          renderer.setClearColor(0x000000, 0); 

          if (shaderMaterial.uniforms.mirrorX_bool) {
              shaderMaterial.uniforms.mirrorX_bool.value = settings.mirrorWebcam;
          }

          const baseHue = SBNF_HUES_SCENE.lightLavender;
          const hueShift = (audioData.rms * 60 + audioData.trebleEnergy * 120 + performance.now() / 2000) % 360;
          const finalHue = (baseHue + hueShift) % 360;
          const saturation = 70 + audioData.midEnergy * 30;
          const lightness = 45 + audioData.rms * 30;
          const [r, g, b] = hslToRgb(finalHue, saturation, Math.min(80, lightness)); 

          if (shaderMaterial.uniforms.dynamicColorVec3) {
              shaderMaterial.uniforms.dynamicColorVec3.value.setRGB(r, g, b);
          }
          
          const baseOpacity = 0.75 + audioData.rms * 0.25; 
          if (shaderMaterial.uniforms.opacityFactor) {
              shaderMaterial.uniforms.opacityFactor.value = Math.min(1.0, baseOpacity * settings.brightCap);
          }

          const canvasAspect = canvasWidth / canvasHeight;
          const videoAspect = webcamElement.videoWidth / webcamElement.videoHeight;
          let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;

          if (canvasAspect > videoAspect) {
              scaleY = 1;
              scaleX = videoAspect / canvasAspect;
              offsetX = (1 - scaleX) / 2;
          } else { 
              scaleX = 1;
              scaleY = canvasAspect / videoAspect;
              offsetY = (1 - scaleY) / 2;
          }
          if (shaderMaterial.uniforms.textureScale) shaderMaterial.uniforms.textureScale.value.set(scaleX, scaleY);
          if (shaderMaterial.uniforms.textureOffset) shaderMaterial.uniforms.textureOffset.value.set(offsetX, offsetY);
          
          if (shaderMaterial) shaderMaterial.needsUpdate = true;

      } else { 
          if (planeMesh) planeMesh.visible = false;
          const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 10); 
          renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 1);
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
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes&font=poppins',
    dataAiHint: 'glowing orbs abstract shapes',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x000000, 0); 

      const circleGeometry = new THREE.CircleGeometry(1, 32); 
      const planeGeometry = new THREE.PlaneGeometry(1, 1);

      const triSize = 0.7; 
      const triangleShape = new THREE.Shape()
        .moveTo(0, triSize)
        .lineTo(triSize * Math.cos(Math.PI / 6), -triSize * Math.sin(Math.PI / 6))
        .lineTo(-triSize * Math.cos(Math.PI / 6), -triSize * Math.sin(Math.PI / 6))
        .closePath();
      const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
      
      const geometries = [circleGeometry, planeGeometry, triangleGeometry];
      const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.lightPeach];

      return {
        renderer, scene, camera, geometries, sbnfHues,
        activeShapes: [] as Array<{
            mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
            creationTime: number;
            life: number;
            initialScale: number;
            rotationSpeed: number;
            initialOpacity: number;
        }>, 
        lastSpawnTime: 0,
        spawnInterval: 80, 
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.renderer || !webGLAssets.geometries || !webGLAssets.sbnfHues) return;
      const { activeShapes, geometries, sbnfHues, spawnInterval } = webGLAssets;
      const currentTime = performance.now();

      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.15);

      const spawnThreshold = 0.10 + settings.gain * 0.03; 
      if ((audioData.beat || audioData.rms > spawnThreshold) && (currentTime - webGLAssets.lastSpawnTime > spawnInterval)) {
        if (activeShapes.length < 120) { 
          const shapeTypeIndex = Math.floor(Math.random() * geometries.length);
          const geometry = geometries[shapeTypeIndex];
          
          const material = new THREE.MeshBasicMaterial({
            transparent: true, depthWrite: false, opacity: 0, 
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.x = (Math.random() - 0.5) * canvasWidth * 0.9;
          mesh.position.y = (Math.random() - 0.5) * canvasHeight * 0.9;
          mesh.position.z = Math.random() * -3 + 1; 

          const baseScale = 20 + audioData.bassEnergy * 280 + Math.random() * 90;
          const initialScale = baseScale * settings.brightCap * (0.25 + audioData.midEnergy * 0.75);
          mesh.scale.set(0,0,0); 
          
          const rotationSpeed = (Math.random() - 0.5) * 0.035 * (1 + audioData.bpm/150);

          const baseHue = sbnfHues[Math.floor(Math.random() * sbnfHues.length)];
          const hueShift = audioData.trebleEnergy * 100 + (audioData.beat ? 50 : 0) + currentTime / 1800;
          const hue = (baseHue + hueShift) % 360;
          const saturation = 80 + Math.random() * 20 + audioData.midEnergy * 15;
          const lightness = 50 + audioData.rms * 35 + (audioData.beat ? 10 : 0);
          material.color.setHSL(hue / 360, Math.min(1, saturation / 100), Math.min(0.9, lightness / 100));
          
          const initialOpacity = (0.4 + audioData.rms * 0.6 + audioData.trebleEnergy * 0.4) * settings.brightCap;
          const life = 1200 + Math.random() * 1800; 

          activeShapes.push({ mesh, creationTime: currentTime, life, initialScale, rotationSpeed, initialOpacity });
          scene.add(mesh);
          webGLAssets.lastSpawnTime = currentTime;
        }
      }

      for (let i = activeShapes.length - 1; i >= 0; i--) {
        const shape = activeShapes[i];
        const age = currentTime - shape.creationTime;
        const lifeProgress = Math.min(1, age / shape.life);

        if (lifeProgress >= 1) {
          scene.remove(shape.mesh);
          shape.mesh.material.dispose(); 
          activeShapes.splice(i, 1);
        } else {
          const fadeInDuration = shape.life * 0.2;
          const fadeOutStart = shape.life * 0.6;
          let currentOpacity;
          if (age < fadeInDuration) currentOpacity = shape.initialOpacity * (age / fadeInDuration);
          else if (age > fadeOutStart) currentOpacity = shape.initialOpacity * (1 - (age - fadeOutStart) / (shape.life - fadeOutStart));
          else currentOpacity = shape.initialOpacity;
          shape.mesh.material.opacity = Math.max(0, currentOpacity);

          const growInDuration = shape.life * 0.3;
          let currentScaleFactor;
          if (age < growInDuration) currentScaleFactor = (age / growInDuration);
          else currentScaleFactor = 1 + Math.sin( (age - growInDuration) * 0.005 * (1 + audioData.midEnergy) ) * 0.15;
          const finalScale = shape.initialScale * currentScaleFactor;
          shape.mesh.scale.set(finalScale, finalScale, finalScale);
          shape.mesh.rotation.z += shape.rotationSpeed;
        }
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.activeShapes) {
          webGLAssets.activeShapes.forEach((shape: any) => {
            if (shape.mesh) {
              if (webGLAssets.scene) webGLAssets.scene.remove(shape.mesh);
              if (shape.mesh.material) shape.mesh.material.dispose();
            }
          });
          webGLAssets.activeShapes = [];
        }
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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Rings&font=poppins',
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      const MAX_RINGS_PER_TYPE = 25; 
      const RING_LIFETIME_MS = 2800; 

      const ringGroups = [
        { type: 'bass', hue: SBNF_HUES_SCENE.orangeRed, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 120 },
        { type: 'mid', hue: SBNF_HUES_SCENE.orangeYellow, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 90 },
        { type: 'treble', hue: SBNF_HUES_SCENE.lightLavender, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 70 }
      ];
      
      const ringGeometry = new THREE.RingGeometry(0.97, 1, 64, 1, 0, Math.PI * 2); 

      return {
        renderer, scene, camera, ringGroups, ringGeometry,
        MAX_RINGS_PER_TYPE, RING_LIFETIME_MS,
        maxVisualRadius: Math.min(canvas.width, canvas.height) * 0.50,
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.ringGroups || !webGLAssets.ringGeometry) return;
      const { ringGroups, ringGeometry, MAX_RINGS_PER_TYPE, RING_LIFETIME_MS, maxVisualRadius } = webGLAssets;
      const currentTime = performance.now();
      
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.18); 

      ringGroups.forEach(group => {
        let energy = 0;
        if (group.type === 'bass') energy = audioData.bassEnergy;
        else if (group.type === 'mid') energy = audioData.midEnergy;
        else if (group.type === 'treble') energy = audioData.trebleEnergy;

        const energyThreshold = group.type === 'bass' ? 0.1 : 0.08;
        if (energy > energyThreshold && currentTime - group.lastSpawnTime > group.spawnInterval / (1 + energy * 3) && group.meshes.length < MAX_RINGS_PER_TYPE) {
          const material = new THREE.MeshBasicMaterial({
            transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide
          });
          const ringMesh = new THREE.Mesh(ringGeometry, material);
          
          (ringMesh.userData as any).creationTime = currentTime;
          (ringMesh.userData as any).initialEnergy = energy; 
          (ringMesh.userData as any).baseHue = group.hue;

          scene.add(ringMesh);
          group.meshes.push(ringMesh);
          group.lastSpawnTime = currentTime;
        }

        for (let i = group.meshes.length - 1; i >= 0; i--) {
          const mesh = group.meshes[i];
          const meshUserData = mesh.userData as any;
          const age = currentTime - meshUserData.creationTime;
          const lifeProgress = age / RING_LIFETIME_MS;

          if (lifeProgress >= 1) {
            scene.remove(mesh);
            (mesh.material as THREE.Material).dispose(); 
            group.meshes.splice(i, 1);
            continue;
          }

          const currentRadius = lifeProgress * maxVisualRadius * (0.2 + meshUserData.initialEnergy * 0.8);
          mesh.scale.set(currentRadius, currentRadius, 1);

          const opacityFalloff = (1 - lifeProgress) * (1 - lifeProgress); 
          const opacity = opacityFalloff * meshUserData.initialEnergy * settings.brightCap * 2.8 * (0.5 + audioData.rms * 0.5);
          (mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, opacity));
          
          const hueShift = lifeProgress * 70 + (audioData.beat ? 35 : 0) + performance.now()/1800;
          const hue = (meshUserData.baseHue + hueShift) % 360;
          const saturation = 90 + meshUserData.initialEnergy * 10;
          const lightness = 55 + meshUserData.initialEnergy * 30 + (audioData.beat ? 10 : 0);
          (mesh.material as THREE.MeshBasicMaterial).color.setHSL(hue / 360, Math.min(1, saturation / 100), Math.min(0.9, lightness / 100));
        }
      });
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.ringGroups) {
          webGLAssets.ringGroups.forEach((group: any) => {
            group.meshes.forEach((mesh: THREE.Mesh) => {
              if (webGLAssets.scene) webGLAssets.scene.remove(mesh);
              if (mesh.material) (mesh.material as THREE.Material).dispose();
            });
            group.meshes = [];
          });
        }
        if (webGLAssets.ringGeometry) webGLAssets.ringGeometry.dispose();
      }
    },
  },
   {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins',
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      const GRID_SIZE_X = 20; 
      const GRID_SIZE_Y = Math.floor(GRID_SIZE_X * (canvas.height / canvas.width));
      const CELL_COUNT = GRID_SIZE_X * GRID_SIZE_Y;
      const cellWidth = canvas.width / GRID_SIZE_X;
      const cellHeight = canvas.height / GRID_SIZE_Y;
      
      const cellGeometry = new THREE.PlaneGeometry(cellWidth * 0.85, cellHeight * 0.85); 
      const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });

      const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, CELL_COUNT);
      scene.add(instancedMesh);

      const dummy = new THREE.Object3D();
      const cellStates = new Array(CELL_COUNT).fill(null).map(() => ({
        color: new THREE.Color(SBNF_HUES_SCENE.black), 
        targetColor: new THREE.Color(SBNF_HUES_SCENE.black),
      }));

      let i = 0;
      for (let y = 0; y < GRID_SIZE_Y; y++) {
        for (let x = 0; x < GRID_SIZE_X; x++) {
          dummy.position.set(
            (x - GRID_SIZE_X / 2 + 0.5) * cellWidth,
            (y - GRID_SIZE_Y / 2 + 0.5) * cellHeight,
            0
          );
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
          instancedMesh.setColorAt(i, cellStates[i].color);
          i++;
        }
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
      
      const sbnfHuesForGrid = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      return { 
        renderer, scene, camera, instancedMesh, cellStates, GRID_SIZE_X, GRID_SIZE_Y, CELL_COUNT, sbnfHuesForGrid
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.cellStates) return;
      const { instancedMesh, cellStates, CELL_COUNT, sbnfHuesForGrid } = webGLAssets;
      
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.25);

      const spectrum = audioData.spectrum;
      const spectrumLength = spectrum.length;
      const beatFactor = audioData.beat ? 1.5 : 1.0;
      const time = performance.now() * 0.001;

      for (let i = 0; i < CELL_COUNT; i++) {
        const spectrumIndex = Math.floor((i / CELL_COUNT) * spectrumLength + time * 5) % spectrumLength;
        const energy = spectrum[spectrumIndex] / 255;
        
        const baseHue = sbnfHuesForGrid[(i + Math.floor(time * 2)) % sbnfHuesForGrid.length];
        const hue = (baseHue + energy * 60 + (audioData.beat ? 40 : 0)) % 360;
        const saturation = 80 + energy * 20;
        const lightness = Math.min(0.8, (0.1 + energy * 0.7 + audioData.rms * 0.2) * settings.brightCap * beatFactor);
        
        cellStates[i].targetColor.setHSL(hue / 360, saturation / 100, lightness);
        cellStates[i].color.lerp(cellStates[i].targetColor, 0.15); 
        instancedMesh.setColorAt(i, cellStates[i].color);
      }
      
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.instancedMesh) {
            if (webGLAssets.instancedMesh.geometry) webGLAssets.instancedMesh.geometry.dispose();
            if (webGLAssets.instancedMesh.material) (webGLAssets.instancedMesh.material as THREE.Material).dispose();
        }
      }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins',
    dataAiHint: 'audio spectrum analysis',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = `hsl(var(--background-hsl))`; 
      ctx.fillRect(0, 0, width, height);

      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5);

      if (isAudioSilent) {
        ctx.fillStyle = `hsl(var(--foreground-hsl))`;
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const barWidth = width / audioData.spectrum.length;
        const [barSR, barSG, barSB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 30); 
        ctx.strokeStyle = `rgba(${barSR*255}, ${barSG*255}, ${barSB*255}, 0.3)`;
        ctx.lineWidth = 1;
        for (let k = 0; k < audioData.spectrum.length; k++) {
          ctx.strokeRect(k * barWidth, height - (height * 0.03), barWidth -1 , (height * 0.03));
        }
        return;
      }

      const barWidth = width / audioData.spectrum.length;
      const effectiveBrightCap = Math.max(0.1, settings.brightCap);
      const sbnfHuesForBars = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      audioData.spectrum.forEach((value, i) => {
        const normalizedValue = value / 255;
        const barHeightBase = normalizedValue * height * effectiveBrightCap * 1.3;
        const barHeight = Math.max(0.5, barHeightBase * (0.4 + audioData.rms * 0.6 + (audioData.beat ? 0.25 : 0) ) );

        const hueIndex = Math.floor((i / audioData.spectrum.length) * sbnfHuesForBars.length);
        const baseHue = sbnfHuesForBars[hueIndex % sbnfHuesForBars.length];
        const hue = (baseHue + normalizedValue * 50 + (audioData.beat ? 40 : 0) + performance.now() / 900) % 360; 
        const saturation = 90 + normalizedValue * 15;
        const lightness = 45 + normalizedValue * 45 + (settings.gamma - 1) * 20 + (audioData.beat ? 15 : 0);

        ctx.fillStyle = `hsl(${hue}, ${Math.min(100, saturation)}%, ${Math.min(85, lightness)}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 0.5, barHeight); 

        if (normalizedValue > 0.25) { 
          ctx.fillStyle = `hsla(${(hue + 30) % 360}, ${Math.min(100, saturation + 10)}%, ${Math.min(95, lightness + 30)}%, 0.8)`;
          ctx.fillRect(i * barWidth, height - barHeight * 1.03, barWidth - 0.5, barHeight * 0.25);
        }
      });
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins',
    dataAiHint: 'abstract explosion particles',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 100; // Start camera further back

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);

      const MAX_PARTICLES = 8000; // Increased particle count
      const positions = new Float32Array(MAX_PARTICLES * 3);
      const colors = new Float32Array(MAX_PARTICLES * 3);
      const velocities = new Float32Array(MAX_PARTICLES * 3); // x, y, z components
      const lifetimes = new Float32Array(MAX_PARTICLES); // remaining life

      const sbnfHuesForBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
      const tempColor = new THREE.Color();

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const i3 = i * 3;
        positions[i3] = positions[i3 + 1] = positions[i3 + 2] = 0; // Start at origin
        velocities[i3] = velocities[i3 + 1] = velocities[i3 + 2] = 0; // Start static
        lifetimes[i] = 0; // Dead initially

        // Assign a base color, will be overwritten on spawn
        tempColor.setHSL(sbnfHuesForBurst[i % sbnfHuesForBurst.length] / 360, 1.0, 0.7);
        colors[i3] = tempColor.r;
        colors[i3 + 1] = tempColor.g;
        colors[i3 + 2] = tempColor.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      // We'll manage alpha via vertex colors later if needed, or material opacity

      const material = new THREE.PointsMaterial({
        size: 2.5, // Slightly larger base size
        vertexColors: true,
        transparent: true,
        opacity: 0.8, // Base opacity
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particleSystem = new THREE.Points(geometry, material);
      scene.add(particleSystem);

      return {
        renderer, scene, camera, particleSystem, material, geometry,
        positions, colors, velocities, lifetimes,
        MAX_PARTICLES,
        sbnfHues: sbnfHuesForBurst,
        lastBeatTime: 0,
        lastAmbientSpawnTime: 0,
        lastFrameTime: performance.now(),
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.particleSystem) return;

      const {
        particleSystem, material, geometry,
        positions, colors, velocities, lifetimes,
        MAX_PARTICLES, sbnfHues
      } = webGLAssets;

      const currentTime = performance.now();
      const deltaTime = Math.min(0.05, (currentTime - (webGLAssets.lastFrameTime || currentTime)) / 1000.0);
      webGLAssets.lastFrameTime = currentTime;

      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.15); // SBNF Black with trails

      material.size = (1.5 + audioData.rms * 5 + settings.brightCap * 2);
      material.opacity = Math.min(1, 0.5 + audioData.rms * 0.5 + settings.brightCap * 0.3);

      const beatBurstCooldown = 100; // ms
      const ambientSpawnRate = 100 + audioData.rms * 300; // particles per second
      const ambientSpawnInterval = 1000 / ambientSpawnRate;

      let particlesToSpawnOnBeat = 0;
      if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatBurstCooldown)) {
        particlesToSpawnOnBeat = Math.floor(MAX_PARTICLES * (0.2 + audioData.bassEnergy * 0.6)); // Spawn 20-80% of particles
        webGLAssets.lastBeatTime = currentTime;
      }

      let particlesToSpawnAmbient = 0;
      if (currentTime - (webGLAssets.lastAmbientSpawnTime || 0) > ambientSpawnInterval) {
        particlesToSpawnAmbient = Math.floor(ambientSpawnRate * deltaTime);
        webGLAssets.lastAmbientSpawnTime = currentTime;
      }
      
      const tempColor = new THREE.Color();

      for (let i = 0; i < MAX_PARTICLES; i++) {
        lifetimes[i] -= deltaTime;
        const i3 = i * 3;

        if (lifetimes[i] <= 0) { // Particle is dead, try to respawn
          let spawn = false;
          let life = 1.0 + Math.random() * 1.5; // 1 to 2.5 seconds
          let speed = 0;
          let baseHue;

          if (particlesToSpawnOnBeat > 0) {
            spawn = true;
            particlesToSpawnOnBeat--;
            speed = 50 + Math.random() * 100 * (audioData.bassEnergy + 0.5) * (audioData.rms + 0.2);
            baseHue = sbnfHues[i % 2 === 0 ? 0 : 1]; // OrangeRed or OrangeYellow for bursts
            life *= 0.7; // Shorter life for burst particles
          } else if (particlesToSpawnAmbient > 0 && audioData.rms > 0.02) {
            spawn = true;
            particlesToSpawnAmbient--;
            speed = 10 + Math.random() * 30 * (audioData.midEnergy + audioData.trebleEnergy + 0.2);
            baseHue = sbnfHues[i % 2 === 0 ? 2 : 3]; // Lavender or LightPeach for ambient
          }

          if (spawn) {
            lifetimes[i] = life;
            positions[i3] = (Math.random() - 0.5) * 0.1; // Start near center
            positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.1;

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
            velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
            velocities[i3 + 2] = speed * Math.cos(phi);

            const colorHue = (baseHue + (Math.random() * 60 - 30) + audioData.trebleEnergy * 40) % 360;
            const colorSaturation = 0.8 + Math.random() * 0.2;
            const colorLightness = 0.6 + Math.random() * 0.2 + audioData.rms * 0.2;
            tempColor.setHSL(colorHue / 360, colorSaturation, Math.min(0.9, colorLightness));
            colors[i3] = tempColor.r;
            colors[i3 + 1] = tempColor.g;
            colors[i3 + 2] = tempColor.b;
          }
        }

        if (lifetimes[i] > 0) {
          positions[i3] += velocities[i3] * deltaTime;
          positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
          positions[i3 + 2] += velocities[i3 + 2] * deltaTime;

          // Apply some drag
          velocities[i3] *= 0.98;
          velocities[i3 + 1] *= 0.98;
          velocities[i3 + 2] *= 0.98;
          
          // Fade out color (alpha)
          const alpha = Math.min(1.0, (lifetimes[i] / (1.0 + Math.random()*1.5)) * 2.0); // Fade faster at the end
          // For PointsMaterial, alpha is part of material.opacity, or we can tint colors to black
          const originalColor = new THREE.Color(colors[i3], colors[i3+1], colors[i3+2]);
          originalColor.multiplyScalar(alpha); // Fade by darkening
          colors[i3] = originalColor.r;
          colors[i3+1] = originalColor.g;
          colors[i3+2] = originalColor.b;

        } else { // Keep dead particles invisible and at origin
            positions[i3] = positions[i3 + 1] = positions[i3 + 2] = 0;
            colors[i3] = colors[i3 + 1] = colors[i3 + 2] = 0; // Black/transparent
        }
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel&font=poppins',
    dataAiHint: 'geometric tunnel flight tron',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 10; 

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      const numSegments = 25;
      const segmentSpacing = 12; 
      const tunnelLength = numSegments * segmentSpacing;
      const segments: THREE.Mesh[] = [];
      
      const geometry = new THREE.TorusGeometry(18, 0.2, 8, 50); 
      const sbnfHuesForTunnel = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.orangeYellow];

      for (let i = 0; i < numSegments; i++) {
        const [r,g,bVal] = hslToRgb(sbnfHuesForTunnel[i % sbnfHuesForTunnel.length], 100, 60); 
        const material = new THREE.MeshBasicMaterial({ 
          wireframe: true,
          color: new THREE.Color(r,g,bVal), 
          transparent: true,
          opacity: 0.75 
        }); 
        const segment = new THREE.Mesh(geometry, material);
        segment.position.z = -i * segmentSpacing;
        segment.rotation.x = Math.PI / 2; 
        scene.add(segment);
        segments.push(segment);
      }
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0); 
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 1);
      
      return { 
        renderer, scene, camera, segments, tunnelLength, segmentSpacing, 
        lastFrameTime: performance.now(), sbnfHues: sbnfHuesForTunnel,
        cameraBaseZ: camera.position.z, cameraBaseFov: camera.fov,
       };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.segments || !webGLAssets.sbnfHues || typeof webGLAssets.cameraBaseFov === 'undefined') return;

      const { segments, tunnelLength, segmentSpacing, sbnfHues, cameraBaseFov } = webGLAssets;
      const currentTime = performance.now();
      const deltaTime = Math.min(0.05, (currentTime - (webGLAssets.lastFrameTime || currentTime)) / 1000.0); 
      webGLAssets.lastFrameTime = currentTime;

      const travelSpeedBase = 25 + audioData.bpm * 0.12; 
      const travelSpeed = (travelSpeedBase + audioData.rms * 60) * deltaTime; 
      camera.position.z -= travelSpeed;

      const color = new THREE.Color();

      segments.forEach((segment, i) => {
        if (segment.position.z > camera.position.z + segmentSpacing) { 
          segment.position.z -= tunnelLength; 
        }

        const scaleFactorBase = 0.8 + Math.sin(currentTime * 0.0015 + i * 0.4) * 0.15; 
        const scaleFactorAudio = audioData.bassEnergy * 0.6 + (audioData.beat ? 0.35 : 0);
        segment.scale.setScalar(Math.max(0.35, scaleFactorBase + scaleFactorAudio * settings.brightCap));

        let targetHue;
        if (audioData.beat && (i % 3 === 0)) { 
            targetHue = SBNF_HUES_SCENE.orangeRed;
        } else {
            targetHue = (SBNF_HUES_SCENE.tronBlue + audioData.trebleEnergy * 60 + currentTime / 2000) % 360;
        }
        
        const lightness = 0.55 + audioData.rms * 0.4 + (audioData.beat ? 0.30 : 0) + settings.brightCap * 0.1;
        const [r,g,bVal] = hslToRgb(targetHue, 98, Math.min(0.85, lightness)); 
        color.setRGB(r,g,bVal);
        
        if (segment.material instanceof THREE.MeshBasicMaterial) {
            segment.material.color = color;
            segment.material.opacity = Math.min(0.95, 0.65 + audioData.rms * 0.35 + settings.brightCap * 0.2);
        }
        
        segment.rotation.z += (audioData.trebleEnergy * 0.025 + 0.001 + audioData.bpm * 0.00002) * (i % 2 === 0 ? 1.2 : -1.4) * deltaTime * 60;
        segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0006 + i * 0.35) * audioData.midEnergy * 0.6; 
      });

      camera.fov = cameraBaseFov - audioData.rms * 35 * settings.gamma + (audioData.beat ? 8 : 0) ; 
      camera.fov = Math.max(35, Math.min(105, camera.fov)); 
      if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix();
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
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins',
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = (hueOptions[Math.floor(Math.random() * hueOptions.length)] + performance.now() / 300) % 360; 
        const lightness = 75 + Math.random() * 20; 
        ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${Math.min(1, settings.brightCap * 1.2)})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = `hsl(var(--background-hsl))`; 
        ctx.fillRect(0, 0, width, height);
      }
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Finale&font=poppins',
    dataAiHint: 'grand particle explosion fireworks',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        camera.position.z = 50; 

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        const PARTICLE_COUNT = 6000; // Reduced count
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const colors = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);
        const sbnfHuesForFinale = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.deepPurple];
        const color = new THREE.Color();

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 0.1;
            positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.1;

            velocities[i3] = (Math.random() - 0.5) * 0.15;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.15;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.15;
            
            const hue = sbnfHuesForFinale[i % sbnfHuesForFinale.length];
            color.setHSL(hue / 360, 0.9 + Math.random() * 0.1, 0.6 + Math.random() * 0.1); // Slightly less bright base
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 0.8, // Reduced base size
            vertexColors: true,
            transparent: true,
            opacity: 0.70, 
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);
        
        return {
            renderer, scene, camera, particles, particleMaterial, particleGeometry,
            sbnfHues: sbnfHuesForFinale, velocities,
            lastBeatTime: 0, lastFrameTime: performance.now(),
            cameraBaseZ: camera.position.z,
        };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.velocities || !webGLAssets.particleGeometry || !webGLAssets.sbnfHues || typeof webGLAssets.cameraBaseZ === 'undefined') return;

        const { particles, particleMaterial, particleGeometry, sbnfHues, velocities, cameraBaseZ } = webGLAssets;
        const positions = particleGeometry.attributes.position.array as Float32Array;
        const colorsAttribute = particleGeometry.attributes.color.array as Float32Array;
        const PARTICLE_COUNT = positions.length / 3;

        const currentTime = performance.now();
        const deltaTime = Math.min(0.05, (currentTime - (webGLAssets.lastFrameTime || currentTime)) / 1000.0);
        webGLAssets.lastFrameTime = currentTime;

        const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
        renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.25); // Adjusted trail fade

        const effectiveBrightCap = Math.max(0.1, settings.brightCap);
        particleMaterial.opacity = Math.min(0.65, effectiveBrightCap * 0.6 * (0.3 + audioData.rms * 0.4)); // Adjusted opacity
        particleMaterial.size = Math.max(0.1, (0.2 + effectiveBrightCap * (audioData.rms * 2.0 + audioData.bassEnergy * 1.5 + audioData.trebleEnergy * 1.0))); // Adjusted size

        const color = new THREE.Color();
        const dragFactor = 0.975; 
        const positionResetThreshold = 100; 
        const movementMultiplier = 40 + audioData.rms * 25; 
        const gravityToCenter = 0.06 + audioData.midEnergy * 0.18; 
        const beatRefractoryPeriod = 70; 

        if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatRefractoryPeriod)) {
            webGLAssets.lastBeatTime = currentTime;
            const burstStrength = 20.0 + audioData.bassEnergy * 40.0 + audioData.rms * 30.0; 

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * 0.1; 
                positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
                positions[i3 + 2] = (Math.random() - 0.5) * 0.1;

                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const speed = Math.random() * burstStrength * 0.60; 

                velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
                velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
                velocities[i3 + 2] = speed * Math.cos(phi);

                const burstHueIndex = (i + Math.floor(currentTime / 20)) % sbnfHues.length; 
                const hueLightness = 0.55 + Math.random() * 0.10 + audioData.trebleEnergy * 0.05; 
                color.setHSL(sbnfHues[burstHueIndex] / 360, 1.0, Math.min(0.85, hueLightness)); 
                colorsAttribute[i3] = color.r;
                colorsAttribute[i3 + 1] = color.g;
                colorsAttribute[i3 + 2] = color.b;
            }
            if (particleGeometry.attributes.color) particleGeometry.attributes.color.needsUpdate = true;
        }

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            const dx = -positions[i3];
            const dy = -positions[i3 + 1];
            const dz = -positions[i3 + 2];
            const distSqToCenter = dx * dx + dy * dy + dz * dz;
            
            if (distSqToCenter > 0.0001) {
                const distToCenter = Math.sqrt(distSqToCenter);
                const attractionForce = gravityToCenter / (distSqToCenter * 0.025 + 0.025); 
                velocities[i3] += (dx / distToCenter) * attractionForce * deltaTime;
                velocities[i3 + 1] += (dy / distToCenter) * attractionForce * deltaTime;
                velocities[i3 + 2] += (dz / distToCenter) * attractionForce * deltaTime;
            }

            positions[i3] += velocities[i3] * deltaTime * movementMultiplier;
            positions[i3 + 1] += velocities[i3 + 1] * deltaTime * movementMultiplier;
            positions[i3 + 2] += velocities[i3 + 2] * deltaTime * movementMultiplier;

            velocities[i3] *= dragFactor;
            velocities[i3 + 1] *= dragFactor;
            velocities[i3 + 2] *= dragFactor;

            const distSqFromOrigin = positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2;
            const speedSq = velocities[i3] ** 2 + velocities[i3 + 1] ** 2 + velocities[i3 + 2] ** 2;

            if (distSqFromOrigin > positionResetThreshold * positionResetThreshold || (speedSq < 0.00004 && distSqFromOrigin > 12)) { 
                positions[i3] = (Math.random() - 0.5) * 0.04;
                positions[i3 + 1] = (Math.random() - 0.5) * 0.04;
                positions[i3 + 2] = (Math.random() - 0.5) * 0.04;
                velocities[i3] = (Math.random() - 0.5) * 0.35;
                velocities[i3 + 1] = (Math.random() - 0.5) * 0.35;
                velocities[i3 + 2] = (Math.random() - 0.5) * 0.35;
            }
        }

        if (particleGeometry.attributes.position) particleGeometry.attributes.position.needsUpdate = true;
        particles.rotation.y += 0.0012 * (1 + audioData.trebleEnergy * 3.0); 
        particles.rotation.x += 0.0008 * (1 + audioData.midEnergy * 3.0);
        camera.position.z = cameraBaseZ - audioData.rms * 15; 
        camera.lookAt(scene.position);
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.particleGeometry) webGLAssets.particleGeometry.dispose();
            if (webGLAssets.particleMaterial) webGLAssets.particleMaterial.dispose();
            if (webGLAssets.scene && webGLAssets.particles) {
                webGLAssets.scene.remove(webGLAssets.particles);
            }
            if(webGLAssets.velocities) webGLAssets.velocities = null; 
        }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";

