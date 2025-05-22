
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins', // SBNF Theme
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

      if (webcamElement && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0 && settings.showWebcam) {
        videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.colorSpace = THREE.SRGBColorSpace;


        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);
        
        const [defaultR, defaultG, defaultB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 47);
        shaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            webcamTexture: { value: videoTexture },
            dynamicColorVec3: { value: new THREE.Color(defaultR, defaultG, defaultB) }, 
            opacityFactor: { value: 1.0 },
            mirrorX_bool: { value: settings.mirrorWebcam }, 
          },
          vertexShader: `
            varying vec2 vUv;
            uniform bool mirrorX_bool;
            void main() {
              vUv = uv;
              if (mirrorX_bool) {
                vUv.x = 1.0 - vUv.x;
              }
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D webcamTexture;
            uniform vec3 dynamicColorVec3; 
            uniform float opacityFactor; 
            varying vec2 vUv;

            void main() {
              vec4 texColor = texture2D(webcamTexture, vUv);
              float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
              float mask = smoothstep(0.3, 0.6, luma); // Adjust thresholds for silhouette crispness
              vec3 silhouetteColor = dynamicColorVec3 * mask; // Apply color to silhouette
              
              // Output silhouette with transparency based on mask and opacityFactor
              gl_FragColor = vec4(silhouetteColor, texColor.a * mask * opacityFactor);
            }
          `,
          transparent: true,
          depthWrite: false, 
        });

        planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        renderer.setClearColor(0x000000, 0); 
      } else {
        const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 15); // Darker SBNF Purple
        renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 1);
      }
      
      return { renderer, scene, camera, videoTexture, planeMesh, shaderMaterial };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.renderer) {
          console.warn("Mirror Silhouette: WebGL assets not ready or renderer missing.");
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
            const hueShift = (audioData.rms * 60 + audioData.trebleEnergy * 120 + performance.now() / 200) % 360;
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

            if (planeMesh.geometry && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0 && canvasWidth > 0 && canvasHeight > 0) {
                const canvasAspect = canvasWidth / canvasHeight;
                const videoAspect = webcamElement.videoWidth / webcamElement.videoHeight;
                
                planeMesh.scale.set(1, 1, 1);

                if (canvasAspect > videoAspect) { 
                    planeMesh.scale.x = canvasAspect / videoAspect;
                    planeMesh.scale.y = 1;
                } else { 
                    planeMesh.scale.x = 1;
                    planeMesh.scale.y = videoAspect / canvasAspect;
                }
            }
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
      const triSize = 0.5; 
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
        geometries,
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
          mesh.position.x = (Math.random() - 0.5) * canvasWidth;
          mesh.position.y = (Math.random() - 0.5) * canvasHeight;
          mesh.position.z = Math.random() * -3 +1; 

          const baseScale = 25 + audioData.bassEnergy * 280 + Math.random() * 90;
          const initialScale = baseScale * settings.brightCap * (0.25 + audioData.midEnergy * 0.75);
          mesh.scale.set(0,0,0); 
          
          const rotationSpeed = (Math.random() - 0.5) * 0.035 * (1 + audioData.bpm/150);

          const baseHue = sbnfHues[Math.floor(Math.random() * sbnfHues.length)];
          const hueShift = audioData.trebleEnergy * 100 + (audioData.beat ? 50 : 0) + currentTime / 180;
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
            currentScaleFactor = (age / growInDuration);
          } else {
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
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.2); // Semi-transparent black for trails

      const MAX_RINGS_PER_TYPE = 20;
      const RING_LIFETIME_MS = 2500;

      const ringGroups = [
        { type: 'bass', hue: SBNF_HUES_SCENE.orangeRed, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 100 },
        { type: 'mid', hue: SBNF_HUES_SCENE.orangeYellow, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 80 },
        { type: 'treble', hue: SBNF_HUES_SCENE.lightLavender, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 60 }
      ];
      
      const ringGeometry = new THREE.RingGeometry(0.95, 1, 64); // innerRadius, outerRadius, thetaSegments

      return {
        renderer, scene, camera, ringGroups, ringGeometry,
        MAX_RINGS_PER_TYPE, RING_LIFETIME_MS,
        maxVisualRadius: Math.min(canvas.width, canvas.height) * 0.48,
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.ringGroups || !webGLAssets.ringGeometry) return;
      const { ringGroups, ringGeometry, MAX_RINGS_PER_TYPE, RING_LIFETIME_MS, maxVisualRadius } = webGLAssets;
      const currentTime = performance.now();
      
      renderer.setClearColor(0x000000, settings.sceneTransitionActive ? 0.22 : 0.18); // For trails

      ringGroups.forEach(group => {
        let energy = 0;
        if (group.type === 'bass') energy = audioData.bassEnergy;
        else if (group.type === 'mid') energy = audioData.midEnergy;
        else if (group.type === 'treble') energy = audioData.trebleEnergy;

        if (energy > 0.05 && currentTime - group.lastSpawnTime > group.spawnInterval / (1 + energy * 2) && group.meshes.length < MAX_RINGS_PER_TYPE) {
          const material = new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: false,
            opacity: 0, // Will be set based on energy
            // side: THREE.DoubleSide // Rings are thin, double side helps
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
            // Geometry is shared, do not dispose here
            group.meshes.splice(i, 1);
            continue;
          }

          const currentRadius = lifeProgress * maxVisualRadius * (0.15 + meshUserData.initialEnergy * 0.85);
          mesh.scale.set(currentRadius, currentRadius, 1);

          const opacity = (1 - lifeProgress) * meshUserData.initialEnergy * settings.brightCap * 2.5 * (0.6 + audioData.rms * 0.4);
          (mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, opacity));
          
          const hueShift = lifeProgress * 60 + (audioData.beat ? 30 : 0) + performance.now()/200;
          const hue = (meshUserData.baseHue + hueShift) % 360;
          const saturation = 85 + meshUserData.initialEnergy * 15;
          const lightness = 60 + meshUserData.initialEnergy * 30 + (audioData.beat ? 15 : 0);
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
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins', // SBNF Theme
    dataAiHint: 'neon grid pulse',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.33 : 0.28;
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0); 
      ctx.fillStyle = `rgba(${bgR*255}, ${bgG*255}, ${bgB*255}, ${fadeAlpha * 1.2})`; 
      ctx.fillRect(0, 0, width, height);

      const gridSize = 6 + Math.floor(audioData.rms * 20 + audioData.midEnergy * 12);
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const maxRadiusBase = Math.min(cellWidth, cellHeight) / 1.3;

      const sbnfHuesForGrid = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const spectrumIndex = (i * gridSize + j + Math.floor(performance.now()/600)) % audioData.spectrum.length;
          const energy = audioData.spectrum[spectrumIndex] / 255;
          const beatFactor = audioData.beat ? 2.5 : 1.0;
          const maxRadius = maxRadiusBase * beatFactor;
          const centerX = i * cellWidth + cellWidth / 2;
          const centerY = j * cellHeight + cellHeight / 2;

          const radius = maxRadius * energy * settings.brightCap * (0.15 + audioData.rms * 0.85 + audioData.bassEnergy * 0.5);
          if (radius < 1.5) continue;

          const baseHue = sbnfHuesForGrid[(i * gridSize + j + Math.floor(performance.now() / 350)) % sbnfHuesForGrid.length];
          const hue = (baseHue + energy * 80 + (audioData.beat ? 45 : 0) + audioData.trebleEnergy * 50) % 360;
          const lightness = 45 + energy * 40 + (audioData.beat ? 15 : 0);
          const alpha = 0.35 + energy * 0.65;
          const effectiveAlpha = alpha * settings.brightCap * 1.2;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 6 + energy * 12, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${Math.min(90, lightness + 35)}%, ${effectiveAlpha * 0.6})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, ${Math.min(85, lightness)}%, ${Math.min(0.95, effectiveAlpha)})`;
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    rendererType: '2d',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins', // SBNF Colors
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
        const hue = (baseHue + normalizedValue * 50 + (audioData.beat ? 40 : 0) + performance.now() / 90) % 360;
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
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins', // SBNF Theme
    dataAiHint: 'abstract explosion particles',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      const fadeAlpha = settings.sceneTransitionActive && settings.sceneTransitionDuration > 0 ? 0.2 : 0.15;
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
      const numStaticParticles = 70 + Math.floor(audioData.rms * 200 + audioData.trebleEnergy * 60);
      for (let i = 0; i < numStaticParticles; i++) {
        const angle = (i / numStaticParticles) * Math.PI * 2 + (performance.now() / 2200) * (i % 2 === 0 ? 1.2 : -1.2);
        const spectrumIndex = i % audioData.spectrum.length;
        const energy = audioData.spectrum[spectrumIndex] / 255;
        const maxRadius = Math.min(width, height) * (0.05 + audioData.midEnergy * 0.4 + audioData.bassEnergy * 0.12);
        const currentRadius = maxRadius * (0.1 + energy * 0.9);
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const particleSize = (1.8 + energy * 7.0 + audioData.rms * 2.5) * settings.brightCap;
        const hue = (sbnfHuesForBurst[i % sbnfHuesForBurst.length] + energy * 60 + (audioData.beat ? 35 : 0) + performance.now() / 80) % 360;
        ctx.fillStyle = `hsla(${hue}, ${95 + energy * 5}%, ${65 + energy * 25 + (audioData.beat ? 10:0)}%, ${0.4 + energy * 0.6 + audioData.rms * 0.25})`;
        ctx.beginPath(); ctx.arc(x, y, particleSize, 0, Math.PI * 2); ctx.fill();
      }

      if (audioData.beat) {
        const particleCount = 250 + Math.floor(audioData.rms * 500 + audioData.bassEnergy * 450);
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = (Math.random() * audioData.rms * Math.min(width, height) * 0.9) + (audioData.bassEnergy * Math.min(width, height) * 0.6);
          const x = centerX + Math.cos(angle) * radius * (1 + Math.random() * 0.4);
          const y = centerY + Math.sin(angle) * radius * (1 + Math.random() * 0.4);
          const size = (2.8 + Math.random() * 18 * (audioData.rms + audioData.bassEnergy * 1.1)) * settings.brightCap;
          const baseHue = sbnfHuesForBurst[(i + Math.floor(audioData.bassEnergy * 15)) % sbnfHuesForBurst.length];
          const hue = (baseHue + (Math.random() * 60 - 30) + audioData.trebleEnergy * 35) % 360;
          ctx.fillStyle = `hsla(${hue}, 100%, ${75 + audioData.trebleEnergy * 15}%, ${0.8 + audioData.midEnergy * 0.2})`;
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
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 1);

      const numSegments = 25;
      const segmentSpacing = 12; 
      const tunnelLength = numSegments * segmentSpacing;
      const segments: THREE.Mesh[] = [];
      
      const geometry = new THREE.TorusGeometry(18, 0.15, 8, 50); 
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

        const hueIndex = Math.floor( (i + currentTime * 0.0002 * (50 + audioData.midEnergy * 100) ) % sbnfHues.length);
        const baseHue = sbnfHues[hueIndex];
        const hue = (baseHue + audioData.trebleEnergy * 120 + (audioData.beat ? 70 : 0) + currentTime / 250) % 360;
        const targetHue = (baseHue === SBNF_HUES_SCENE.tronBlue || baseHue === SBNF_HUES_SCENE.deepPurple) ? hue : (baseHue + 20) % 360;
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
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins', // SBNF Theme
    dataAiHint: 'strobe light flash',
    draw: (ctx, audioData, settings) => {
      const { width, height } = ctx.canvas;
      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = (hueOptions[Math.floor(Math.random() * hueOptions.length)] + performance.now() / 30) % 360;
        const lightness = 80 + Math.random() * 20; 
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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale&font=poppins',
    dataAiHint: 'grand particle explosion fireworks',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        camera.position.z = 50; 

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 0);
        renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.15); // More transparent for trails

        const PARTICLE_COUNT = 12000; 
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
            size: 1.3, 
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
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

        const effectiveBrightCap = Math.max(0.1, settings.brightCap);
        particleMaterial.opacity = Math.min(0.8, effectiveBrightCap * 0.7 * (0.3 + audioData.rms * 0.5));
        particleMaterial.size = Math.max(0.2, (0.3 + effectiveBrightCap * (audioData.rms * 3.0 + audioData.bassEnergy * 2.5 + audioData.trebleEnergy * 1.5)));


        const color = new THREE.Color();
        const dragFactor = 0.965;
        const positionResetThreshold = 120; 
        const movementMultiplier = 50 + audioData.rms * 35;
        const gravityToCenter = 0.08 + audioData.midEnergy * 0.25;
        const beatRefractoryPeriod = 40; 

        if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatRefractoryPeriod)) {
            webGLAssets.lastBeatTime = currentTime;
            const burstStrength = 30.0 + audioData.bassEnergy * 60.0 + audioData.rms * 45.0;

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * 0.2; 
                positions[i3 + 1] = (Math.random() - 0.5) * 0.2;
                positions[i3 + 2] = (Math.random() - 0.5) * 0.2;

                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const speed = Math.random() * burstStrength * 0.75;

                velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
                velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
                velocities[i3 + 2] = speed * Math.cos(phi);

                const burstHueIndex = (i + Math.floor(currentTime / 15)) % sbnfHues.length;
                const hueLightness = 0.65 + Math.random() * 0.15 + audioData.trebleEnergy * 0.1;
                color.setHSL(sbnfHues[burstHueIndex] / 360, 1.0, Math.min(0.85, hueLightness));
                colorsAttribute[i3] = color.r;
                colorsAttribute[i3 + 1] = color.g;
                colorsAttribute[i3 + 2] = color.b;
            }
            particleGeometry.attributes.color.needsUpdate = true;
        }

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            const dx = -positions[i3];
            const dy = -positions[i3 + 1];
            const dz = -positions[i3 + 2];
            const distSqToCenter = dx * dx + dy * dy + dz * dz;
            
            if (distSqToCenter > 0.0001) {
                const distToCenter = Math.sqrt(distSqToCenter);
                const attractionForce = gravityToCenter / (distSqToCenter * 0.02 + 0.02);
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

            if (distSqFromOrigin > positionResetThreshold * positionResetThreshold || (speedSq < 0.00005 && distSqFromOrigin > 15)) {
                positions[i3] = (Math.random() - 0.5) * 0.05;
                positions[i3 + 1] = (Math.random() - 0.5) * 0.05;
                positions[i3 + 2] = (Math.random() - 0.5) * 0.05;
                velocities[i3] = (Math.random() - 0.5) * 0.4;
                velocities[i3 + 1] = (Math.random() - 0.5) * 0.4;
                velocities[i3 + 2] = (Math.random() - 0.5) * 0.4;
            }
        }

        particleGeometry.attributes.position.needsUpdate = true;
        particles.rotation.y += 0.0015 * (1 + audioData.trebleEnergy * 3.5);
        particles.rotation.x += 0.0010 * (1 + audioData.midEnergy * 3.5);
        camera.position.z = cameraBaseZ - audioData.rms * 20; 
        camera.lookAt(scene.position);
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.particleGeometry) webGLAssets.particleGeometry.dispose();
            if (webGLAssets.particleMaterial) webGLAssets.particleMaterial.dispose();
            if (webGLAssets.scene && webGLAssets.particles) {
                webGLAssets.scene.remove(webGLAssets.particles);
            }
            webGLAssets.velocities = null;
        }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";

