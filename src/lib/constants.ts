
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
  showWebcam: false,
  mirrorWebcam: true,
  currentSceneId: 'radial_burst', // SBNF default
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
      // Use OrthographicCamera for 2D plane effects
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

      const [defaultR, defaultG, defaultB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 47); // SBNF Purple

      if (webcamElement && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0 && settings.showWebcam) {
        videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.colorSpace = THREE.SRGBColorSpace;

        const planeGeometry = new THREE.PlaneGeometry(1, 1); // Use normalized geometry
        
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
              // Clamp UVs to avoid texture repeating if scaling makes them > 1 or < 0
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
        // Scale the plane to fill the orthographic camera view
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
          console.warn("Mirror Silhouette: WebGL assets not ready or renderer missing.");
          if(renderer) { // Still clear to background if renderer exists but scene not ready
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
            renderer.setClearColor(0x000000, 0); // Transparent background behind the plane

            if (shaderMaterial.uniforms.mirrorX_bool) {
                shaderMaterial.uniforms.mirrorX_bool.value = settings.mirrorWebcam;
            }

            // Color reactivity - SBNF inspired
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

            // Cover scaling logic for video texture
            const canvasAspect = canvasWidth / canvasHeight;
            const videoAspect = webcamElement.videoWidth / webcamElement.videoHeight;
            let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;

            if (canvasAspect > videoAspect) { // Canvas is wider than video, fit height, crop width
                scaleY = 1;
                scaleX = videoAspect / canvasAspect;
                offsetX = (1 - scaleX) / 2;
            } else { // Canvas is taller or same aspect, fit width, crop height
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
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes&font=poppins', // SBNF Theme
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

      const triangleShape = new THREE.Shape();
      const triSize = 0.7; 
      triangleShape.moveTo(0, triSize);
      triangleShape.lineTo(triSize * Math.cos(Math.PI / 6), -triSize * Math.sin(Math.PI / 6));
      triangleShape.lineTo(-triSize * Math.cos(Math.PI / 6), -triSize * Math.sin(Math.PI / 6));
      triangleShape.closePath();
      const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
      
      const geometries = [circleGeometry, planeGeometry, triangleGeometry];
      const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.lightPeach];

      return {
        renderer,
        scene,
        camera,
        geometries, // Store shared geometries
        sbnfHues,
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
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.15); // Subtle trails

      const spawnThreshold = 0.10 + settings.gain * 0.03; 
      if ((audioData.beat || audioData.rms > spawnThreshold) && (currentTime - webGLAssets.lastSpawnTime > spawnInterval)) {
        if (activeShapes.length < 120) { 
          const shapeTypeIndex = Math.floor(Math.random() * geometries.length);
          const geometry = geometries[shapeTypeIndex];
          
          const material = new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: false, 
            opacity: 0, 
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
          shape.mesh.material.dispose(); // Dispose individual material
          // Do not dispose shared geometry here
          activeShapes.splice(i, 1);
        } else {
          const fadeInDuration = shape.life * 0.2;
          const fadeOutStart = shape.life * 0.6;
          
          let currentOpacity;
          if (age < fadeInDuration) {
            currentOpacity = shape.initialOpacity * (age / fadeInDuration);
          } else if (age > fadeOutStart) {
            currentOpacity = shape.initialOpacity * (1 - (age - fadeOutStart) / (shape.life - fadeOutStart));
          } else {
            currentOpacity = shape.initialOpacity;
          }
          shape.mesh.material.opacity = Math.max(0, currentOpacity);

          const growInDuration = shape.life * 0.3;
          let currentScaleFactor;
          if (age < growInDuration) {
            currentScaleFactor = (age / growInDuration); // Ease in scale
          } else {
            // Gentle pulse after initial growth
            currentScaleFactor = 1 + Math.sin( (age - growInDuration) * 0.005 * (1 + audioData.midEnergy) ) * 0.15;
          }
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
              // Shared geometries are disposed of below
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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Rings&font=poppins', // SBNF Theme
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      const MAX_RINGS_PER_TYPE = 25; // Slightly increased
      const RING_LIFETIME_MS = 2800; // Slightly longer life

      const ringGroups = [
        { type: 'bass', hue: SBNF_HUES_SCENE.orangeRed, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 120 },
        { type: 'mid', hue: SBNF_HUES_SCENE.orangeYellow, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 90 },
        { type: 'treble', hue: SBNF_HUES_SCENE.lightLavender, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 70 }
      ];
      
      // Shared geometry for all rings of a certain thickness
      const ringGeometry = new THREE.RingGeometry(0.97, 1, 64, 1, 0, Math.PI * 2); // innerRadius, outerRadius, thetaSegments

      return {
        renderer, scene, camera, ringGroups, ringGeometry,
        MAX_RINGS_PER_TYPE, RING_LIFETIME_MS,
        maxVisualRadius: Math.min(canvas.width, canvas.height) * 0.50, // Rings can expand a bit more
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.ringGroups || !webGLAssets.ringGeometry) return;
      const { ringGroups, ringGeometry, MAX_RINGS_PER_TYPE, RING_LIFETIME_MS, maxVisualRadius } = webGLAssets;
      const currentTime = performance.now();
      
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.18); // Slightly faster fade for trails

      ringGroups.forEach(group => {
        let energy = 0;
        if (group.type === 'bass') energy = audioData.bassEnergy;
        else if (group.type === 'mid') energy = audioData.midEnergy;
        else if (group.type === 'treble') energy = audioData.trebleEnergy;

        const energyThreshold = group.type === 'bass' ? 0.1 : 0.08;
        if (energy > energyThreshold && currentTime - group.lastSpawnTime > group.spawnInterval / (1 + energy * 3) && group.meshes.length < MAX_RINGS_PER_TYPE) {
          const material = new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: false,
            opacity: 0, 
            side: THREE.DoubleSide // Important for thin rings
          });
          const ringMesh = new THREE.Mesh(ringGeometry, material);
          
          (ringMesh.userData as any).creationTime = currentTime;
          (ringMesh.userData as any).initialEnergy = energy; // Store initial energy for consistent animation
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

          // Ring expands based on lifeProgress and its initial energy
          const currentRadius = lifeProgress * maxVisualRadius * (0.2 + meshUserData.initialEnergy * 0.8);
          mesh.scale.set(currentRadius, currentRadius, 1);

          const opacityFalloff = (1 - lifeProgress) * (1 - lifeProgress); // Faster fade out
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
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins', // SBNF Theme
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      const GRID_SIZE_X = 20; // Example grid size
      const GRID_SIZE_Y = Math.floor(GRID_SIZE_X * (canvas.height / canvas.width));
      const CELL_COUNT = GRID_SIZE_X * GRID_SIZE_Y;
      const cellWidth = canvas.width / GRID_SIZE_X;
      const cellHeight = canvas.height / GRID_SIZE_Y;
      
      const cellGeometry = new THREE.PlaneGeometry(cellWidth * 0.85, cellHeight * 0.85); // Cell with slight padding
      const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });

      const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, CELL_COUNT);
      scene.add(instancedMesh);

      const dummy = new THREE.Object3D();
      const cellStates = new Array(CELL_COUNT).fill(null).map(() => ({
        color: new THREE.Color(SBNF_HUES_SCENE.black), // Start dim
        targetColor: new THREE.Color(SBNF_HUES_SCENE.black),
        scale: 1,
        targetScale: 1,
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
        renderer, scene, camera, instancedMesh, cellStates, GRID_SIZE_X, GRID_SIZE_Y, CELL_COUNT, cellWidth, cellHeight, sbnfHuesForGrid
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.cellStates) return;
      const { instancedMesh, cellStates, GRID_SIZE_X, GRID_SIZE_Y, CELL_COUNT, sbnfHuesForGrid } = webGLAssets;
      
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.25); // SBNF Black with trails

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
        cellStates[i].color.lerp(cellStates[i].targetColor, 0.15); // Smooth color transition
        instancedMesh.setColorAt(i, cellStates[i].color);

        // Optional: Pulsing scale
        // const scalePulse = 1.0 + Math.sin(time * 5 + i * 0.5) * 0.1 * energy * beatFactor;
        // cellStates[i].targetScale = scalePulse;
        // cellStates[i].scale = THREE.MathUtils.lerp(cellStates[i].scale, cellStates[i].targetScale, 0.1);
        // const matrix = new THREE.Matrix4();
        // instancedMesh.getMatrixAt(i, matrix);
        // const position = new THREE.Vector3();
        // matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
        // matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(cellStates[i].scale, cellStates[i].scale, 1));
        // instancedMesh.setMatrixAt(i, matrix);
      }
      
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
      // if (instancedMesh.instanceMatrix) instancedMesh.instanceMatrix.needsUpdate = true; // Only if scale changes
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
        const hue = (baseHue + normalizedValue * 50 + (audioData.beat ? 40 : 0) + performance.now() / 900) % 360; // Slower hue shift
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
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins',
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.22 : 0.18; // Slightly faster fade
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      ctx.fillStyle = `rgba(${bgR*255}, ${bgG*255}, ${bgB*255}, ${fadeAlpha * 1.3})`; 
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const spectrumSumForSilenceCheck = audioData.spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (audioData.spectrum.length * 0.5) && !audioData.beat;

      if (isAudioSilent) {
        ctx.fillStyle = `hsl(var(--foreground-hsl))`;
        ctx.textAlign = 'center';
        ctx.font = `16px ${SBNF_BODY_FONT_FAMILY}`;
        ctx.fillText('Low audio signal. Make some noise or check input gain.', width / 2, height / 2);
        const numPlaceholderCircles = 10;
        const [cirR, cirG, cirB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 40); 
        ctx.strokeStyle = `rgba(${cirR*255}, ${cirG*255}, ${cirB*255}, 0.25)`;
        ctx.lineWidth = 1;
        for (let i = 0; i < numPlaceholderCircles; i++) {
          const r = (Math.min(width, height) * 0.02) + (i * Math.min(width, height) * 0.04);
          ctx.beginPath(); ctx.arc(centerX, centerY, r, 0, Math.PI * 2); ctx.stroke();
        }
        return;
      }

      const sbnfHuesForBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
      const numStaticParticles = 80 + Math.floor(audioData.rms * 250 + audioData.trebleEnergy * 70); // Increased count
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 2000) * (i % 2 === 0 ? 1.3 : -1.3); // Slower rotation
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.08 + audioData.midEnergy * 0.45 + audioData.bassEnergy * 0.15); // Slightly larger max radius
        const currentRadius = maxRadius * (0.15 + energy * 0.85);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (2.0 + energy * 8.0 + audioData.rms * 3.0) * settings.brightCap; // Slightly larger particles
        const hue = (sbnfHuesForBurst[i % sbnfHuesForBurst.length] + energy * 70 + (audioData.beat ? 40 : 0) + performance.now() / 700) % 360; // Faster hue shift
        ctx.fillStyle = `hsla(${hue}, ${95 + energy * 5}%, ${68 + energy * 22 + (audioData.beat ? 12:0)}%, ${0.5 + energy * 0.5 + audioData.rms * 0.3})`; // More reactive opacity
        ctx.beginPath(); ctx.arc(x, y, particleSize, 0, Math.PI * 2); ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 300 + Math.floor(audioData.rms * 600 + audioData.bassEnergy * 500); // Increased burst
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 1.0) + (audioData.bassEnergy * Math.min(width, height) * 0.7); // Larger burst radius
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.5);
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.5);
          const size = (3.0 + Math.random() * 20 * (audioData.rms + audioData.bassEnergy * 1.2)) * settings.brightCap; // Larger burst particles
          const baseHue = sbnfHuesForBurst[(i + Math.floor(audioData.bassEnergy * 20)) % sbnfHuesForBurst.length];
          const hue = (baseHue + (Math.random() * 70 - 35) + audioData.trebleEnergy * 40) % 360; // More hue variation
          ctx.fillStyle = `hsla(${hue}, 100%, ${78 + audioData.trebleEnergy * 12}%, ${0.85 + audioData.midEnergy * 0.15})`; // Brighter burst
          ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        }
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
      
      const geometry = new THREE.TorusGeometry(18, 0.2, 8, 50); // Slightly thicker wireframe
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
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0); // SBNF Black
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

        // Tron-like color scheme: primarily cyan/blue, with orange/red highlights on beats or high energy
        let targetHue;
        if (audioData.beat && (i % 3 === 0)) { // Highlight some segments on beat
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
          webGLAssets.scene.remove(segment);
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
        const hue = (hueOptions[Math.floor(Math.random() * hueOptions.length)] + performance.now() / 300) % 360; // Slower hue shift
        const lightness = 75 + Math.random() * 20; 
        ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${Math.min(1, settings.brightCap * 1.2)})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = `hsl(var(--background-hsl))`; // SBNF Black
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
        
        const PARTICLE_COUNT = 8000; // Reduced from 12000
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
            color.setHSL(hue / 360, 0.9 + Math.random() * 0.1, 0.6 + Math.random() * 0.2);
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 1.1, // Reduced base size
            vertexColors: true,
            transparent: true,
            opacity: 0.80, // Slightly reduced base opacity
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
        renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.22); // Adjusted trail fade

        const effectiveBrightCap = Math.max(0.1, settings.brightCap);
        particleMaterial.opacity = Math.min(0.75, effectiveBrightCap * 0.65 * (0.3 + audioData.rms * 0.5)); // Adjusted opacity reactivity
        particleMaterial.size = Math.max(0.15, (0.25 + effectiveBrightCap * (audioData.rms * 2.5 + audioData.bassEnergy * 2.0 + audioData.trebleEnergy * 1.2))); // Adjusted size reactivity


        const color = new THREE.Color();
        const dragFactor = 0.97; // Slightly more drag
        const positionResetThreshold = 110; 
        const movementMultiplier = 45 + audioData.rms * 30; // Reduced movement multiplier
        const gravityToCenter = 0.07 + audioData.midEnergy * 0.20; // Reduced gravity
        const beatRefractoryPeriod = 50; // Slightly longer refractory

        if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatRefractoryPeriod)) {
            webGLAssets.lastBeatTime = currentTime;
            const burstStrength = 25.0 + audioData.bassEnergy * 50.0 + audioData.rms * 40.0; // Adjusted burst strength

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * 0.15; 
                positions[i3 + 1] = (Math.random() - 0.5) * 0.15;
                positions[i3 + 2] = (Math.random() - 0.5) * 0.15;

                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const speed = Math.random() * burstStrength * 0.70; // Adjusted speed

                velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
                velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
                velocities[i3 + 2] = speed * Math.cos(phi);

                const burstHueIndex = (i + Math.floor(currentTime / 20)) % sbnfHues.length; // Faster color shift
                const hueLightness = 0.60 + Math.random() * 0.10 + audioData.trebleEnergy * 0.08; // Slightly less bright burst
                color.setHSL(sbnfHues[burstHueIndex] / 360, 1.0, Math.min(0.80, hueLightness)); // Cap lightness
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
                const attractionForce = gravityToCenter / (distSqToCenter * 0.025 + 0.025); // Adjusted attraction
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

            if (distSqFromOrigin > positionResetThreshold * positionResetThreshold || (speedSq < 0.00004 && distSqFromOrigin > 12)) { // Adjusted reset conditions
                positions[i3] = (Math.random() - 0.5) * 0.04;
                positions[i3 + 1] = (Math.random() - 0.5) * 0.04;
                positions[i3 + 2] = (Math.random() - 0.5) * 0.04;
                velocities[i3] = (Math.random() - 0.5) * 0.35;
                velocities[i3 + 1] = (Math.random() - 0.5) * 0.35;
                velocities[i3 + 2] = (Math.random() - 0.5) * 0.35;
            }
        }

        if (particleGeometry.attributes.position) particleGeometry.attributes.position.needsUpdate = true;
        particles.rotation.y += 0.0012 * (1 + audioData.trebleEnergy * 3.0); // Slower base rotation
        particles.rotation.x += 0.0008 * (1 + audioData.midEnergy * 3.0);
        camera.position.z = cameraBaseZ - audioData.rms * 15; // Less camera zoom
        camera.lookAt(scene.position);
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.particleGeometry) webGLAssets.particleGeometry.dispose();
            if (webGLAssets.particleMaterial) webGLAssets.particleMaterial.dispose();
            if (webGLAssets.scene && webGLAssets.particles) {
                webGLAssets.scene.remove(webGLAssets.particles);
            }
            webGLAssets.velocities = null; // Clear velocities array
        }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";
