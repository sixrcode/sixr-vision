
import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets, ProceduralVine } from '@/types';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

export const FFT_SIZES = [128, 256, 512] as const;

// SBNF Palette HSL (from the branding guide)
// Deep Purple #5A36BB -> hsl(258, 56%, 47%)
// Light Lavender #E1CCFF -> hsl(267, 100%, 90%)
// Mustard Gold #FDB143 -> hsl(36, 98%, 63%)
// Bright Orange #FF441A -> hsl(13, 100%, 55%)
// Cream #FFECDA -> hsl(30, 100%, 93%)
// Black #000000 -> hsl(0, 0%, 0%)
// For Tron-like accents:
// Tron Blue: ~197 HSL (e.g., hsl(197, 90%, 58%))
const SBNF_HUES_SCENE = {
  black: 0,
  orangeRed: 13,
  orangeYellow: 36,
  lightPeach: 30,
  lightLavender: 267,
  deepPurple: 258,
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

// Function to generate a simple Perlin-like noise texture
function generateNoiseTexture(width: number, height: number): THREE.DataTexture {
  const size = width * height;
  const data = new Uint8Array(4 * size); // RGBA

  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    const x = (i % width) / width;
    const y = Math.floor(i / width) / height;

    let val = 0;
    for (let octave = 1; octave <= 4; octave *= 2) {
      const freq = octave;
      val += (1 / freq) * (Math.sin(freq * x * Math.PI * 5 + Math.random()*0.2 + i*0.01) + Math.cos(freq * y * Math.PI * 7 + Math.random()*0.3 + i*0.005));
    }
    val = (val / 1.75 + 1) / 2; // Normalize accumulated octaves and ensure range [0,1]

    const value = Math.floor(val * 155) + 100; // Brighter noise, 100-255 range
    data[stride] = value; // R
    data[stride + 1] = value; // G
    data[stride + 2] = value; // B
    data[stride + 3] = 255; // A
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
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
  currentSceneId: 'radial_burst',
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
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent", // SBNF Themed Default
  enablePeriodicAiOverlay: false,
  aiOverlayRegenerationInterval: 45, // Default: 45 seconds
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
    displayLabel: 'MIRROR',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=MIRROR&font=poppins', // SBNF Deep Purple BG, Cream Text
    dataAiHint: 'webcam silhouette performer',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      // Use OrthographicCamera for full-screen 2D plane effect
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const webGLAssets: Partial<WebGLSceneAssets> & {
        lastCanvasWidth?: number;
        lastCanvasHeight?: number;
        noiseTexture?: THREE.DataTexture;
        vinesData?: { activeVines: ProceduralVine[]; nextVineId: number; lastSpawnTime: number; spawnCooldown: number; maxVines: number };
        GRAPE_COUNT?: number;
        lastGrapeSpawnTime?: number;
        tempColor?: THREE.Color;
        lastFrameTimeWebGL?: number;
        grapeGeometry?: THREE.BufferGeometry;
        grapeMaterial?: THREE.PointsMaterial;
        grapePositions?: Float32Array;
        grapeColors?: Float32Array;
        grapeTargetSizes?: Float32Array;
        grapeCurrentSizes?: Float32Array;
        grapeLifetimes?: Float32Array;
        grapeSpawnTimes?: Float32Array;
      } = {
        scene,
        camera,
        lastCanvasWidth: 0,
        lastCanvasHeight: 0,
        noiseTexture: generateNoiseTexture(256, 256),
        vinesData: { activeVines: [], nextVineId: 0, lastSpawnTime: 0, spawnCooldown: 200, maxVines: 15 },
        GRAPE_COUNT: 200,
        lastGrapeSpawnTime: 0,
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
      };

      if (webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0) {
        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.NearestFilter;
        videoTexture.magFilter = THREE.NearestFilter;
        videoTexture.generateMipmaps = false;
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        webGLAssets.videoTexture = videoTexture;

        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);
        const vertexShader = `
          varying vec2 vUv;
          uniform bool u_mirrorX;
          void main() {
            vUv = uv;
            if (u_mirrorX) {
              vUv.x = 1.0 - vUv.x;
            }
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `;
        const fragmentShader = `
          uniform sampler2D u_webcamTexture;
          uniform sampler2D u_noiseTexture;
          uniform vec3 u_rimColor;
          uniform vec3 u_fillColor1;
          uniform vec3 u_fillColor2;
          uniform float u_opacityFactor;
          uniform float u_time;
          uniform vec2 u_resolution;
          varying vec2 vUv;

          float fresnel(vec2 uv, float power) {
            vec2 centeredUv = uv * 2.0 - 1.0;
            float distFromCenter = length(centeredUv);
            return pow(max(0.0, 1.0 - distFromCenter), power);
          }

          float getLuma(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
          }

          void main() {
            // Checkerboard discard for performance
            if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard;

            vec4 webcamColor = texture2D(u_webcamTexture, vUv);
            float luma = getLuma(webcamColor.rgb);
            float silhouetteMask = smoothstep(0.25, 0.55, luma);

            vec2 noiseUv = vUv * vec2(u_resolution.x / u_resolution.y, 1.0) * 1.5 + vec2(u_time * 0.03, u_time * 0.02);
            vec3 noise = texture2D(u_noiseTexture, noiseUv).rgb;
            vec3 nebulaFill = mix(u_fillColor1, u_fillColor2, noise.r);

            float rim = fresnel(vUv, 2.0);
            vec3 finalColor = vec3(0.0);
            float finalAlpha = 0.0;

            if (silhouetteMask > 0.1) {
              finalColor = mix(nebulaFill, u_rimColor, rim * 0.7);
              finalAlpha = silhouetteMask * u_opacityFactor * 1.85; // Alpha compensation for discard
            } else {
              finalAlpha = 0.0;
            }
            finalAlpha *= webcamColor.a;
            gl_FragColor = vec4(finalColor, clamp(finalAlpha, 0.0, 1.0));
          }
        `;
        const shaderMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            u_webcamTexture: { value: videoTexture },
            u_noiseTexture: { value: webGLAssets.noiseTexture },
            u_rimColor: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeYellow / 360, 0.98, 0.63) },
            u_fillColor1: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.3) },
            u_fillColor2: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.lightLavender / 360, 1.0, 0.5) },
            u_opacityFactor: { value: 1.0 },
            u_mirrorX: { value: settings.mirrorWebcam },
            u_time: { value: 0.0 },
            u_resolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
          },
          transparent: true,
          depthWrite: false,
        });
        webGLAssets.shaderMaterial = shaderMaterial;

        const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        webGLAssets.planeMesh = planeMesh;

        // Grape particles setup
        const GRAPE_COUNT = webGLAssets.GRAPE_COUNT!;
        const grapePositions = new Float32Array(GRAPE_COUNT * 3);
        const grapeColors = new Float32Array(GRAPE_COUNT * 3);
        const grapeCurrentSizes = new Float32Array(GRAPE_COUNT);
        const grapeTargetSizes = new Float32Array(GRAPE_COUNT);
        const grapeLifetimes = new Float32Array(GRAPE_COUNT);
        const grapeSpawnTimes = new Float32Array(GRAPE_COUNT);

        for (let i = 0; i < GRAPE_COUNT; i++) {
          grapeLifetimes[i] = 0;
        }

        const grapeGeometry = new THREE.BufferGeometry();
        grapeGeometry.setAttribute('position', new THREE.BufferAttribute(grapePositions, 3));
        grapeGeometry.setAttribute('color', new THREE.BufferAttribute(grapeColors, 3));
        grapeGeometry.setAttribute('size', new THREE.BufferAttribute(grapeCurrentSizes, 1));

        const grapeMaterial = new THREE.PointsMaterial({
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });

        const grapes = new THREE.Points(grapeGeometry, grapeMaterial);
        scene.add(grapes);
        webGLAssets.grapes = grapes;
        webGLAssets.grapeGeometry = grapeGeometry;
        webGLAssets.grapeMaterial = grapeMaterial;
        webGLAssets.grapePositions = grapePositions;
        webGLAssets.grapeColors = grapeColors;
        webGLAssets.grapeTargetSizes = grapeTargetSizes;
        webGLAssets.grapeCurrentSizes = grapeCurrentSizes;
        webGLAssets.grapeLifetimes = grapeLifetimes;
        webGLAssets.grapeSpawnTimes = grapeSpawnTimes;
      } else {
        webGLAssets.bgColor = new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.47);
      }
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      if (!webGLAssets) {
        renderer?.setClearColor(0x000000, 0);
        return;
      }

      const { planeMesh, shaderMaterial, videoTexture, bgColor,
              grapes, grapeGeometry, grapeMaterial, grapePositions, grapeColors, grapeTargetSizes, grapeCurrentSizes,
              grapeLifetimes, grapeSpawnTimes, GRAPE_COUNT, tempColor, vinesData,
              lastFrameTimeWebGL: lastTime = performance.now()
       } = webGLAssets as any;

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (shaderMaterial) {
        shaderMaterial.uniforms.u_time.value = currentTime * 0.001;
        shaderMaterial.uniforms.u_resolution.value.set(canvasWidth, canvasHeight);
      }

      if (planeMesh && shaderMaterial && videoTexture && settings.showWebcam && webcamElement && webcamElement.readyState >= webcamElement.HAVE_ENOUGH_DATA) {
        renderer?.setClearAlpha(0.0);
        renderer?.setClearColor(0x000000, 0.0);

        if (videoTexture.image !== webcamElement) videoTexture.image = webcamElement;
        videoTexture.needsUpdate = true;
        shaderMaterial.uniforms.u_mirrorX.value = settings.mirrorWebcam;

        const baseOpacity = settings.brightCap * (0.7 + audioData.rms * 0.5);
        shaderMaterial.uniforms.u_opacityFactor.value = Math.min(1.0, baseOpacity);

        const hueTimeShiftSilhouette = (currentTime / 15000) * 360;
        shaderMaterial.uniforms.u_rimColor.value.setHSL(((SBNF_HUES_SCENE.orangeYellow + hueTimeShiftSilhouette) % 360) / 360, 0.98, 0.63 + audioData.trebleEnergy * 0.1);
        shaderMaterial.uniforms.u_fillColor1.value.setHSL(((SBNF_HUES_SCENE.deepPurple + hueTimeShiftSilhouette * 0.8) % 360) / 360, 0.56, 0.3 + audioData.bassEnergy * 0.2);
        shaderMaterial.uniforms.u_fillColor2.value.setHSL(((SBNF_HUES_SCENE.lightLavender + hueTimeShiftSilhouette * 1.2) % 360) / 360, 1.0, 0.5 + audioData.midEnergy * 0.2);

        if (webGLAssets.lastCanvasWidth !== canvasWidth || webGLAssets.lastCanvasHeight !== canvasHeight) {
          if (planeMesh.geometry) planeMesh.geometry.dispose();
          planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
          webGLAssets.lastCanvasWidth = canvasWidth;
          webGLAssets.lastCanvasHeight = canvasHeight;
          if (camera instanceof THREE.OrthographicCamera) {
            camera.left = canvasWidth / -2; camera.right = canvasWidth / 2;
            camera.top = canvasHeight / 2; camera.bottom = canvasHeight / -2;
            camera.updateProjectionMatrix();
          }
        }
        planeMesh.visible = true;
      } else {
        if (planeMesh) planeMesh.visible = false;
        if (bgColor && renderer) {
             renderer.setClearColor((bgColor as THREE.Color).getHex(), 1);
        }
      }

      if (grapes && grapeLifetimes && grapePositions && grapeColors && grapeCurrentSizes && grapeTargetSizes && grapeSpawnTimes && tempColor && GRAPE_COUNT && vinesData) {
        const beatCooldown = 250;
        let spawnedThisFrameGrapes = 0;
        const maxSpawnPerBeatGrapes = Math.floor(GRAPE_COUNT * 0.10);

        if (audioData.beat && (currentTime - (webGLAssets.lastGrapeSpawnTime || 0) > beatCooldown) && spawnedThisFrameGrapes < maxSpawnPerBeatGrapes) {
            webGLAssets.lastGrapeSpawnTime = currentTime;
            let grapesToSpawnCount = Math.floor(GRAPE_COUNT * (0.03 + audioData.bassEnergy * 0.15));
            grapesToSpawnCount = Math.min(grapesToSpawnCount, GRAPE_COUNT, maxSpawnPerBeatGrapes - spawnedThisFrameGrapes);

            for (let i = 0; i < GRAPE_COUNT && spawnedThisFrameGrapes < grapesToSpawnCount; i++) {
                if (grapeLifetimes[i] <= 0) {
                    const pIdx = i * 3;
                    grapePositions[pIdx] = (Math.random() - 0.5) * canvasWidth * 0.6;
                    grapePositions[pIdx + 1] = (Math.random() - 0.5) * canvasHeight * 0.6;
                    grapePositions[pIdx + 2] = (Math.random() - 0.5) * 100;

                    const initialLifetime = 1.5 + Math.random() * 1.5;
                    grapeLifetimes[i] = initialLifetime;
                    grapeSpawnTimes[i] = currentTime;

                    const [r,g,bVal] = hslToRgb(SBNF_HUES_SCENE.lightLavender, 100, 70 + Math.random() * 20);
                    grapeColors[pIdx] = r; grapeColors[pIdx + 1] = g; grapeColors[pIdx + 2] = bVal;

                    grapeTargetSizes[i] = (10 + audioData.bassEnergy * 30 + Math.random() * 8) * Math.max(0.3, settings.brightCap);
                    grapeCurrentSizes[i] = 0.1;
                    spawnedThisFrameGrapes++;
                }
            }
        }
        for (let i = 0; i < GRAPE_COUNT; i++) {
            const pIdx = i * 3;
            if (grapeLifetimes[i] > 0) {
                grapeLifetimes[i] -= deltaTime;

                const ageMs = (currentTime - grapeSpawnTimes[i]);
                // Use the initial lifetime for ratio calculation to prevent division by diminishing lifetime
                const initialLifetimeForRatio = (grapeSpawnTimes[i] + grapeLifetimes[i] * 1000) - grapeSpawnTimes[i]; // approx initial lifetime in ms
                const lifeRatio = Math.max(0, Math.min(1, ageMs / (initialLifetimeForRatio + 0.01)));


                const startHue = SBNF_HUES_SCENE.lightLavender; const endHue = SBNF_HUES_SCENE.orangeRed;
                const currentHue = startHue + (endHue - startHue) * lifeRatio;
                const [r,g,bVal] = hslToRgb(currentHue, 100, 55 + (1 - lifeRatio) * 35);
                grapeColors[pIdx] = r; grapeColors[pIdx + 1] = g; grapeColors[pIdx + 2] = bVal;

                const popDurationMs = 300;
                if (ageMs < popDurationMs) {
                    grapeCurrentSizes[i] = Math.min(grapeTargetSizes[i], (ageMs / popDurationMs) * grapeTargetSizes[i]);
                } else {
                    const remainingLifetimeRatio = Math.max(0, grapeLifetimes[i] / ((initialLifetimeForRatio/1000) - (popDurationMs / 1000) + 0.01));
                    grapeCurrentSizes[i] = grapeTargetSizes[i] * Math.pow(remainingLifetimeRatio, 1.5);
                }
                grapeCurrentSizes[i] = Math.max(0.1, grapeCurrentSizes[i]);

                if (grapeLifetimes[i] <= 0) {
                    grapeCurrentSizes[i] = 0;
                }
            } else {
                 grapeCurrentSizes[i] = 0;
            }
        }
        if (grapeGeometry && grapeGeometry.attributes) {
          if(grapeGeometry.attributes.position) (grapeGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          if(grapeGeometry.attributes.color) (grapeGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
          if(grapeGeometry.attributes.size) (grapeGeometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
        }
        if(grapeMaterial) {
          grapeMaterial.needsUpdate = true;
          grapeMaterial.size = 2.0 + audioData.rms * 3; // Dynamic size for all grapes
        }
      }

      // Vine drawing logic (data updated here, drawn on overlay canvas)
      if (vinesData && vinesData.activeVines) {
        const { activeVines, nextVineId, spawnCooldown, maxVines } = vinesData;
        let { lastSpawnTime } = vinesData;

        const midEnergyThreshold = 0.3;
        const time = currentTime * 0.001;

        if (audioData.midEnergy > midEnergyThreshold && currentTime - lastSpawnTime > spawnCooldown && activeVines.length < maxVines) {
          vinesData.lastSpawnTime = currentTime;
          const newVine: ProceduralVine = {
            id: nextVineId,
            points: [],
            color: `hsl(${SBNF_HUES_SCENE.lightLavender + Math.random() * 30 - 15}, 80%, 70%)`,
            opacity: 0.8 + Math.random() * 0.2,
            currentLength: 0,
            maxLength: 50 + Math.random() * 100,
            spawnTime: currentTime,
            lifetime: 3000 + Math.random() * 3000, // 3-6 seconds
            thickness: 1 + Math.random() * 2,
            curlFactor: 0.5 + Math.random() * 1.0,
            angle: Math.random() * Math.PI * 2,
          };
          const edge = Math.floor(Math.random() * 4);
          let startX, startY;
          if (edge === 0) { startX = 0; startY = Math.random() * canvasHeight; } // Left
          else if (edge === 1) { startX = canvasWidth; startY = Math.random() * canvasHeight; } // Right
          else if (edge === 2) { startX = Math.random() * canvasWidth; startY = 0; } // Top
          else { startX = Math.random() * canvasWidth; startY = canvasHeight; } // Bottom
          newVine.points.push({ x: startX, y: startY });

          activeVines.push(newVine);
          vinesData.nextVineId++;
        }

        for (let i = activeVines.length - 1; i >= 0; i--) {
          const vine = activeVines[i];
          if (currentTime - vine.spawnTime > vine.lifetime || vine.opacity <= 0.01) {
            activeVines.splice(i, 1);
            continue;
          }

          vine.opacity = Math.max(0, 1 - (currentTime - vine.spawnTime) / vine.lifetime);

          if (vine.currentLength < vine.maxLength) {
            const lastPoint = vine.points[vine.points.length - 1];
            const angleChange = (Math.sin(time * vine.curlFactor + vine.id * 0.5) + Math.sin(time * 0.3 + vine.id)) * 0.15; // More complex curl
            vine.angle += angleChange;
            const growSpeed = 2 + audioData.midEnergy * 3;
            const newX = lastPoint.x + Math.cos(vine.angle) * growSpeed;
            const newY = lastPoint.y + Math.sin(vine.angle) * growSpeed;

            if (newX > 0 && newX < canvasWidth && newY > 0 && newY < canvasHeight) { // Keep within bounds
                 vine.points.push({ x: newX, y: newY });
                 vine.currentLength++;
            } else { // Stop growing if it hits an edge
                vine.currentLength = vine.maxLength;
            }
          }
        }
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.videoTexture) (webGLAssets.videoTexture as THREE.VideoTexture).dispose();
        if (webGLAssets.planeMesh?.geometry) (webGLAssets.planeMesh.geometry as THREE.PlaneGeometry).dispose();
        if (webGLAssets.shaderMaterial) (webGLAssets.shaderMaterial as THREE.ShaderMaterial).dispose();
        if (webGLAssets.noiseTexture) (webGLAssets.noiseTexture as THREE.DataTexture).dispose();

        if (webGLAssets.grapeGeometry) (webGLAssets.grapeGeometry as THREE.BufferGeometry).dispose();
        if (webGLAssets.grapeMaterial) (webGLAssets.grapeMaterial as THREE.PointsMaterial).dispose();
        if (webGLAssets.grapes && webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(webGLAssets.grapes as THREE.Points);

        if (webGLAssets.vinesData) (webGLAssets.vinesData as any).activeVines = [];
      }
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    displayLabel: 'ECHO',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=ECHO&font=poppins', // SBNF Orange-Red BG, Cream Text
    dataAiHint: 'glowing orbs abstract shapes',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const webGLAssets: Partial<WebGLSceneAssets> & {
        starfieldMesh?: THREE.Mesh;
        starfieldMaterial?: THREE.ShaderMaterial;
        circleInstancedMesh?: THREE.InstancedMesh;
        squareInstancedMesh?: THREE.InstancedMesh;
        triangleInstancedMesh?: THREE.InstancedMesh;
        activeInstances?: any[];
        MAX_SHAPE_INSTANCES?: number;
        dummy?: THREE.Object3D;
        tempColor?: THREE.Color;
        lastSpawnTimeShape?: number;
        spawnCooldown?: number;
        bgColor?: THREE.Color;
        lastFrameTimeWebGL?: number;
        lastStarfieldCanvasWidth?: number;
        lastStarfieldCanvasHeight?: number;
      } = {
        scene, camera,
        activeInstances: [],
        MAX_SHAPE_INSTANCES: 50,
        dummy: new THREE.Object3D(),
        tempColor: new THREE.Color(),
        lastSpawnTimeShape: 0,
        spawnCooldown: 120, // ms
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        lastFrameTimeWebGL: performance.now(),
        lastStarfieldCanvasWidth: 0,
        lastStarfieldCanvasHeight: 0,
      };

      // Starfield Background
      const starfieldGeometry = new THREE.PlaneGeometry(2, 2);
      const starfieldMaterial = new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `
          uniform vec2 u_resolution_star; uniform float u_time_star; varying vec2 vUv;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
          }
          void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution_star.xy; float n = noise(uv * 200.0 + u_time_star * 0.01);
            float star = smoothstep(0.95, 0.97, n); // Smaller, dimmer stars
            float twinkle = sin(u_time_star * 2.0 + uv.x * 100.0 + uv.y * 50.0) * 0.5 + 0.5;
            star *= (0.4 + twinkle * 0.3); // Subtle twinkle
            gl_FragColor = vec4(vec3(star * 0.6), star * 0.4); // Dim stars, more alpha control
          }`,
        uniforms: {
          u_resolution_star: { value: new THREE.Vector2(canvas.width, canvas.height) },
          u_time_star: { value: 0.0 },
        },
        transparent: true, depthWrite: false,
      });
      webGLAssets.starfieldMaterial = starfieldMaterial;
      const starfieldMesh = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
      starfieldMesh.renderOrder = -1; scene.add(starfieldMesh);
      webGLAssets.starfieldMesh = starfieldMesh;

      // Instanced Shapes
      const circleGeometry = new THREE.CircleGeometry(0.5, 32);
      const squareGeometry = new THREE.PlaneGeometry(1, 1);
      const triangleShape = new THREE.Shape();
      triangleShape.moveTo(0, 0.5); triangleShape.lineTo(0.5 * Math.cos(Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(Math.PI / 6 + Math.PI / 2));
      triangleShape.lineTo(0.5 * Math.cos(5 * Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(5 * Math.PI / 6 + Math.PI / 2)); triangleShape.closePath();
      const triangleGeometry = new THREE.ShapeGeometry(triangleShape); triangleGeometry.center();

      const shapeMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.7 });
      
      const MAX_INSTANCES = webGLAssets.MAX_SHAPE_INSTANCES!;
      webGLAssets.circleInstancedMesh = new THREE.InstancedMesh(circleGeometry, shapeMaterial.clone(), MAX_INSTANCES);
      webGLAssets.squareInstancedMesh = new THREE.InstancedMesh(squareGeometry, shapeMaterial.clone(), MAX_INSTANCES);
      webGLAssets.triangleInstancedMesh = new THREE.InstancedMesh(triangleGeometry, shapeMaterial.clone(), MAX_INSTANCES);
      
      [webGLAssets.circleInstancedMesh, webGLAssets.squareInstancedMesh, webGLAssets.triangleInstancedMesh].forEach(mesh => {
        if (mesh) {
          mesh.count = 0;
          scene.add(mesh);
        }
      });

      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.activeInstances || !webGLAssets.starfieldMaterial || !webGLAssets.bgColor ||
          !webGLAssets.circleInstancedMesh || !webGLAssets.squareInstancedMesh || !webGLAssets.triangleInstancedMesh ||
          !webGLAssets.dummy || !webGLAssets.tempColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined') return;

      const {
        starfieldMaterial, starfieldMesh,
        circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh,
        activeInstances, MAX_SHAPE_INSTANCES,
        dummy, tempColor, bgColor, spawnCooldown,
        lastFrameTimeWebGL
      } = webGLAssets as any;

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastFrameTimeWebGL) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;
      const hueTimeShift = (currentTime / 20000) * 360;

      // Update starfield
      starfieldMaterial.uniforms.u_time_star.value = currentTime * 0.001;
      if (starfieldMaterial.uniforms.u_resolution_star) starfieldMaterial.uniforms.u_resolution_star.value.set(canvasWidth, canvasHeight);

      renderer?.setClearColor((bgColor as THREE.Color).getHex(), 1.0);

      const spawnCondition = (audioData.beat && (currentTime - (webGLAssets.lastSpawnTimeShape || 0) > spawnCooldown / 2)) ||
                             (audioData.rms > 0.1 && (currentTime - (webGLAssets.lastSpawnTimeShape || 0) > spawnCooldown));

      if (spawnCondition && activeInstances.length < MAX_SHAPE_INSTANCES! * 3) {
        webGLAssets.lastSpawnTimeShape = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 1.5);

        for (let k = 0; k < numToSpawn; k++) {
          if (activeInstances.length >= MAX_SHAPE_INSTANCES! * 3) break;

          const shapeTypes = ['circle', 'square', 'triangle'];
          const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

          const initialScale = (canvasWidth / 25) * (0.3 + audioData.bassEnergy * 0.5) * Math.max(0.1, settings.brightCap);
          if (initialScale < 2) continue;

          const sbnfGrapeHues = [SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.tronBlue];
          let huePicker = Math.random();
          let selectedBaseHue;
          if (huePicker < 0.4) selectedBaseHue = SBNF_HUES_SCENE.deepPurple;
          else if (huePicker < 0.7) selectedBaseHue = SBNF_HUES_SCENE.lightLavender;
          else if (huePicker < 0.85) selectedBaseHue = SBNF_HUES_SCENE.orangeYellow;
          else selectedBaseHue = sbnfGrapeHues[Math.floor(Math.random() * 2) + 3]; // orangeRed or tronBlue

          const finalHue = (selectedBaseHue + audioData.trebleEnergy * 30 + hueTimeShift) % 360;
          const [r,g,bVal] = hslToRgb(finalHue, 80 + audioData.trebleEnergy * 20, 60 + audioData.midEnergy * 15);

          activeInstances.push({
            id: Math.random(), type: shapeType,
            x: (Math.random() - 0.5) * canvasWidth * 0.9,
            y: (Math.random() - 0.5) * canvasHeight * 0.9,
            z: (Math.random() - 0.5) * 5,
            initialScale,
            maxScale: initialScale * (1.5 + audioData.rms * 2.5),
            currentScale: initialScale * 0.1,
            color: new THREE.Color(r, g, bVal),
            currentOpacity: Math.min(0.85, 0.5 + audioData.rms * 0.5) * settings.brightCap,
            lifetime: 1.2 + Math.random() * 1.3, // seconds
            spawnTime: currentTime,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.002 * (1 + audioData.trebleEnergy),
            initialLifetime: 1.2 + Math.random() * 1.3, // Store initial for fade calculation
          });
        }
      }

      let circleIdx = 0, squareIdx = 0, triangleIdx = 0;
      const newActiveInstances: any[] = [];

      for (const instance of activeInstances) {
        const age = (currentTime - instance.spawnTime) / 1000;
        if (age > instance.lifetime) continue; // Remove if lifetime exceeded
        newActiveInstances.push(instance);

        const lifeProgress = age / instance.initialLifetime;

        const growDuration = 0.3;
        if (age < growDuration) {
          instance.currentScale = instance.initialScale + (instance.maxScale - instance.initialScale) * (age / growDuration);
        } else {
          instance.currentScale = instance.maxScale * (1.0 - (age - growDuration) / (instance.initialLifetime - growDuration));
        }
        instance.currentScale = Math.max(0.01, instance.currentScale);

        instance.rotation += instance.rotationSpeed * deltaTime * 60;
        const finalOpacity = instance.currentOpacity * (1.0 - lifeProgress) * 0.85; // Slightly reduced max opacity for additive

        dummy.position.set(instance.x, instance.y, instance.z);
        dummy.rotation.set(0, 0, instance.rotation);
        dummy.scale.set(instance.currentScale, instance.currentScale, instance.currentScale);
        dummy.updateMatrix();

        const effectiveColor = tempColor!.copy(instance.color).multiplyScalar(finalOpacity);

        if (instance.type === 'circle' && circleIdx < MAX_SHAPE_INSTANCES!) {
          circleInstancedMesh!.setMatrixAt(circleIdx, dummy.matrix);
          circleInstancedMesh!.setColorAt(circleIdx, effectiveColor);
          circleIdx++;
        } else if (instance.type === 'square' && squareIdx < MAX_SHAPE_INSTANCES!) {
          squareInstancedMesh!.setMatrixAt(squareIdx, dummy.matrix);
          squareInstancedMesh!.setColorAt(squareIdx, effectiveColor);
          squareIdx++;
        } else if (instance.type === 'triangle' && triangleIdx < MAX_SHAPE_INSTANCES!) {
          triangleInstancedMesh!.setMatrixAt(triangleIdx, dummy.matrix);
          triangleInstancedMesh!.setColorAt(triangleIdx, effectiveColor);
          triangleIdx++;
        }
      }
      webGLAssets.activeInstances = newActiveInstances;

      circleInstancedMesh!.count = circleIdx;
      squareInstancedMesh!.count = squareIdx;
      triangleInstancedMesh!.count = triangleIdx;

      if (circleIdx > 0) { circleInstancedMesh!.instanceMatrix.needsUpdate = true; circleInstancedMesh!.instanceColor!.needsUpdate = true; }
      if (squareIdx > 0) { squareInstancedMesh!.instanceMatrix.needsUpdate = true; squareInstancedMesh!.instanceColor!.needsUpdate = true; }
      if (triangleIdx > 0) { triangleInstancedMesh!.instanceMatrix.needsUpdate = true; triangleInstancedMesh!.instanceColor!.needsUpdate = true; }

      // console.log('[Echoing Shapes] Active Instances:', activeInstances.length, 'CircleIdx:', circleIdx, 'SquareIdx:', squareIdx, 'TriangleIdx:', triangleIdx);
      // console.log('[Echoing Shapes] Counts - Circles:', circleInstancedMesh.count, 'Squares:', squareInstancedMesh.count, 'Triangles:', triangleInstancedMesh.count);
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        const { starfieldMesh, starfieldMaterial,
                circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh,
                activeInstances } = webGLAssets as any;

        if (starfieldMesh && scene) scene.remove(starfieldMesh);
        if (starfieldMaterial) starfieldMaterial.dispose();
        if (starfieldMesh?.geometry) starfieldMesh.geometry.dispose();

        [circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh].forEach(mesh => {
          if (mesh) {
            if (scene) scene.remove(mesh);
            if(mesh.geometry) mesh.geometry.dispose();
            if(mesh.material) (mesh.material as THREE.Material | THREE.Material[]).dispose();
            // InstancedMesh itself doesn't have a dispose method in older Three.js,
            // but geometry and material disposal is key.
          }
        });
        if(activeInstances) (webGLAssets as any).activeInstances.length = 0;
      }
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    displayLabel: 'RINGS',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=RINGS&font=poppins', // SBNF Orange-Yellow BG, Black Text
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;

        const ringGeometry = new THREE.RingGeometry(0.98, 1, 64);

        return {
            scene, camera,
            activeRings: [[], [], []], // One array per band (bass, mid, treble)
            ringGeometry,
            lastSpawnTimes: [0,0,0],
            tempColor: new THREE.Color(),
            bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
            lastFrameTimeWebGL: performance.now(),
        } as WebGLSceneAssets & {
          activeRings: Array<Array<{mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>, spawnTime: number, lifetime: number, maxRadius: number, initialOpacity: number}>>,
          ringGeometry: THREE.RingGeometry,
          lastSpawnTimes: number[],
          tempColor: THREE.Color,
          bgColor: THREE.Color,
          lastFrameTimeWebGL: number
        };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.ringGeometry || !webGLAssets.activeRings || !webGLAssets.lastSpawnTimes || !webGLAssets.tempColor || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined') return;

        const { ringGeometry, activeRings, lastSpawnTimes, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (renderer) {
            renderer.autoClear = false;
            renderer.setClearColor((bgColor as THREE.Color).getHex(), 0.08);
            renderer.clear();
        }

        const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
        const baseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
        const spawnIntervals = [120, 100, 80];
        const maxRingRadiusBase = Math.min(canvasWidth, canvasHeight) * 0.45;
        const MAX_RINGS_PER_BAND = 20;

        energies.forEach((energy, i) => {
            const effectiveEnergy = Math.max(0.02, energy);
            if (energy > 0.04 && currentTime - lastSpawnTimes[i] > spawnIntervals[i] / (effectiveEnergy * 5 + 0.2)) {
                if (activeRings[i].length < MAX_RINGS_PER_BAND) {
                    lastSpawnTimes[i] = currentTime;
                    const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, opacity: 0, blending: THREE.AdditiveBlending });
                    const ringMesh = new THREE.Mesh(ringGeometry, material);

                    activeRings[i].push({
                      mesh: ringMesh,
                      spawnTime: currentTime,
                      lifetime: 1.0 + energy * 1.0,
                      maxRadius: maxRingRadiusBase * (0.25 + energy * 0.75),
                      initialOpacity: Math.min(0.7, 0.3 + audioData.rms * 0.4) * settings.brightCap * 0.8,
                    });
                    scene.add(ringMesh);
                }
            }

            for (let j = activeRings[i].length - 1; j >= 0; j--) {
                const ring = activeRings[i][j];
                const age = (currentTime - ring.spawnTime) / 1000.0;
                if (age > ring.lifetime) {
                    scene.remove(ring.mesh);
                    ring.mesh.material.dispose();
                    activeRings[i].splice(j, 1);
                    continue;
                }
                const lifeProgress = age / ring.lifetime;
                const currentRadius = lifeProgress * ring.maxRadius;
                if (currentRadius < 1) continue;

                ring.mesh.scale.set(currentRadius, currentRadius, 1);

                const spectrumVal = (audioData.spectrum[i * 10 % audioData.spectrum.length] || 0) / 255;
                const hueTimeShiftRings = (currentTime / 10000) * 360;
                const hue = (baseHues[i] + spectrumVal * 40 + (audioData.beat ? 25 : 0) + hueTimeShiftRings) % 360;
                const [r,g,bVal] = hslToRgb(hue, 90 + energies[i]*10, 50 + energies[i]*20);
                tempColor.setRGB(r,g,bVal);
                ring.mesh.material.color.copy(tempColor);

                const opacityFade = Math.sin(Math.PI * (1.0 - lifeProgress));
                ring.mesh.material.opacity = Math.max(0, opacityFade * ring.initialOpacity);
            }
        });
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.activeRings) {
          (webGLAssets.activeRings as any[][]).forEach(bandRings => {
            bandRings.forEach(ring => {
              if (webGLAssets.scene && ring.mesh) (webGLAssets.scene as THREE.Scene).remove(ring.mesh);
              if (ring.mesh?.material) (ring.mesh.material as THREE.Material).dispose();
            });
          });
          (webGLAssets as any).activeRings = [[],[],[]];
        }
        if (webGLAssets.ringGeometry) (webGLAssets.ringGeometry as THREE.RingGeometry).dispose();
      }
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    displayLabel: 'GRID',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=GRID&font=poppins', // SBNF Lavender BG, Deep Purple Text
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;

        const GRID_SIZE_X = 16;
        const GRID_SIZE_Y = Math.round(GRID_SIZE_X * (canvas.height / canvas.width)) || 1;
        const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

        const cellBaseWidth = canvas.width / GRID_SIZE_X;
        const cellBaseHeight = canvas.height / GRID_SIZE_Y;

        const cellGeometry = new THREE.PlaneGeometry(cellBaseWidth * 0.9, cellBaseHeight * 0.9);
        const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
        const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, totalCells);
        scene.add(instancedMesh);

        const dummy = new THREE.Object3D();
        const initialColor = new THREE.Color(SBNF_HUES_SCENE.black);
        const cellStates: { currentColor: THREE.Color, targetColor: THREE.Color, currentScale: number }[] = [];

        for (let j_idx = 0; j_idx < GRID_SIZE_Y; j_idx++) {
            for (let i_idx = 0; i_idx < GRID_SIZE_X; i_idx++) {
                const index = j_idx * GRID_SIZE_X + i_idx;
                dummy.position.set(
                    (i_idx - GRID_SIZE_X / 2 + 0.5) * cellBaseWidth,
                    (j_idx - GRID_SIZE_Y / 2 + 0.5) * cellBaseHeight,
                    0
                );
                dummy.scale.set(1,1,1);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
                instancedMesh.setColorAt(index, initialColor);
                cellStates.push({ currentColor: new THREE.Color().copy(initialColor), targetColor: new THREE.Color().copy(initialColor), currentScale: 1.0 });
            }
        }
        if (instancedMesh.instanceMatrix) instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

        return {
            scene, camera, instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellBaseWidth, cellBaseHeight, cellStates,
            dummy: new THREE.Object3D(),
            tempColor: new THREE.Color(),
            lastFrameTimeWebGL: performance.now(),
            bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.cellStates || !webGLAssets.dummy || !webGLAssets.tempColor || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined') return;

        const { instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellBaseWidth, cellBaseHeight, cellStates, dummy, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (renderer) {
            renderer.setClearColor((bgColor as THREE.Color).getHex(), 0.15);
        }


        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;
        const sbnfGridHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];

        for (let j = 0; j < GRID_SIZE_Y; j++) {
            for (let i = 0; i < GRID_SIZE_X; i++) {
                const index = j * GRID_SIZE_X + i;
                if (index >= totalCells) continue;

                const spectrumIndex = Math.floor((index / totalCells) * spectrumLength) % spectrumLength;
                const energy = (spectrum[spectrumIndex] || 0) / 255;
                const cellState = cellStates[index];
                const beatFactor = audioData.beat ? 1.2 : 1.0;

                const targetLightness = 0.15 + energy * 0.6 * beatFactor * settings.brightCap;
                const targetSaturation = 0.65 + energy * 0.35;
                const hueTimeShiftGrid = (currentTime / 12000) * 360;
                const baseHue = sbnfGridHues[(i + j + Math.floor(currentTime / 3000)) % sbnfGridHues.length];
                const hue = (baseHue + energy * 40 + (audioData.beat ? 15 : 0) + hueTimeShiftGrid) % 360;

                const [r,g,bVal] = hslToRgb(hue, Math.min(100, targetSaturation*100), Math.min(70, targetLightness*100));
                cellState.targetColor.setRGB(r,g,bVal);
                cellState.currentColor.lerp(cellState.targetColor, 0.15);
                (instancedMesh as THREE.InstancedMesh).setColorAt(index, cellState.currentColor);

                const baseScaleFactor = 1.0;
                const scalePulse = 1.0 + energy * 0.08 * beatFactor * audioData.rms;
                const targetScale = baseScaleFactor * scalePulse;
                cellState.currentScale = cellState.currentScale * 0.92 + targetScale * 0.08;

                (instancedMesh as THREE.InstancedMesh).getMatrixAt(index, dummy.matrix);
                const currentPosition = new THREE.Vector3().setFromMatrixPosition(dummy.matrix);
                dummy.scale.set(cellState.currentScale, cellState.currentScale, 1);
                dummy.position.copy(currentPosition);
                dummy.updateMatrix();
                (instancedMesh as THREE.InstancedMesh).setMatrixAt(index, dummy.matrix);
            }
        }
        if ((instancedMesh as THREE.InstancedMesh).instanceColor) (instancedMesh as THREE.InstancedMesh).instanceColor!.needsUpdate = true;
        if ((instancedMesh as THREE.InstancedMesh).instanceMatrix) (instancedMesh as THREE.InstancedMesh).instanceMatrix.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets && webGLAssets.instancedMesh) {
            const mesh = webGLAssets.instancedMesh as THREE.InstancedMesh;
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) (mesh.material as THREE.Material | THREE.Material[]).dispose();
            if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(mesh);
        }
    },
  },
   {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    displayLabel: 'BARS',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=BARS&font=poppins', // SBNF Deep Purple BG, Mustard Gold Text
    dataAiHint: 'audio spectrum analysis',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const numBars = Math.floor((settings.fftSize / 2) * 0.8);
      const barPlusGapWidth = (canvas.width * 0.95) / numBars;
      const barActualWidth = barPlusGapWidth * 0.75;

      const barGeometry = new THREE.PlaneGeometry(barActualWidth, 1); // Height will be set by scale
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      const dummy = new THREE.Object3D();
      const initialColor = new THREE.Color(SBNF_HUES_SCENE.deepPurple);

      for (let i = 0; i < numBars; i++) {
        const xPosition = (i - (numBars - 1) / 2) * barPlusGapWidth;
        dummy.position.set(xPosition, -canvas.height / 2 + 0.5, 0); // Start at bottom, height will be scaled
        dummy.scale.set(1, 1, 1); // Initial height 1
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, initialColor);
      }
      scene.add(instancedMesh);

      return {
        scene, camera, instancedMesh, numBars, barWidth: barPlusGapWidth, barActualWidth,
        dummy: new THREE.Object3D(),
        tempColor: new THREE.Color(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple/360, 0.56, 0.47), // SBNF Deep Purple
        lastFrameTimeWebGL: performance.now(),
      } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.dummy || !webGLAssets.tempColor || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined') return;
      const { instancedMesh, numBars, barWidth, barActualWidth, dummy, tempColor, bgColor } = webGLAssets as any;

      const currentTime = performance.now();
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (renderer) {
        renderer.setClearColor((bgColor as THREE.Color).getHex(), 1);
      }


      const spectrum = audioData.spectrum;
      const effectiveBrightCap = Math.max(0.05, settings.brightCap);
      const sbnfBarHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];

      const spectrumSumForSilenceCheck = spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (numBars * 0.5);

      for (let i = 0; i < numBars; i++) {
        if (i >= spectrum.length) continue;

        const normalizedValue = isAudioSilent ? 0.001 : (spectrum[i] || 0) / 255;
        const barHeightBase = normalizedValue * canvasHeight * effectiveBrightCap * 1.0;
        const barHeight = Math.max(1, barHeightBase * (0.5 + audioData.rms * 0.5 + (audioData.beat ? 0.2 : 0)));

        dummy.scale.set(1, barHeight, 1);

        const xPosition = (i - (numBars - 1) / 2) * barWidth;
        dummy.position.set(xPosition, barHeight / 2 - canvasHeight / 2, 0);

        dummy.updateMatrix();
        (instancedMesh as THREE.InstancedMesh).setMatrixAt(i, dummy.matrix);

        const hueIndex = Math.floor((i / numBars) * sbnfBarHues.length);
        const baseHue = sbnfBarHues[hueIndex % sbnfBarHues.length];
        const hueTimeShiftBars = (currentTime / 15000) * 360;
        const hue = (baseHue + normalizedValue * 35 + (audioData.beat ? 20 : 0) + hueTimeShiftBars) % 360;
        const saturation = 65 + normalizedValue * 35;
        const lightness = 35 + normalizedValue * 40 + (audioData.beat ? 10 : 0);

        const [r,g,bVal] = hslToRgb(hue, Math.min(100, saturation), Math.min(75, lightness));
        tempColor.setRGB(r, g, bVal);
        (instancedMesh as THREE.InstancedMesh).setColorAt(i, tempColor);
      }
      if ((instancedMesh as THREE.InstancedMesh).instanceMatrix) (instancedMesh as THREE.InstancedMesh).instanceMatrix.needsUpdate = true;
      if ((instancedMesh as THREE.InstancedMesh).instanceColor) (instancedMesh as THREE.InstancedMesh).instanceColor!.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets && webGLAssets.instancedMesh) {
        const mesh = webGLAssets.instancedMesh as THREE.InstancedMesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) (mesh.material as THREE.Material | THREE.Material[]).dispose();
        if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(mesh);
      }
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    displayLabel: 'BURST',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=BURST&font=poppins', // SBNF Orange-Red BG, Black Text
    dataAiHint: 'abstract explosion particles',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 200;

      const PARTICLE_COUNT = 4000;
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT);
      const spawnTimes = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
          lifetimes[i] = 0;
          const pIdx = i * 3;
          positions[pIdx] = 0; positions[pIdx + 1] = 100000; positions[pIdx + 2] = 0; // Start off-screen
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 2.0,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      return {
        scene, camera, particles, material, geometry, positions, colors, velocities, lifetimes, spawnTimes,
        PARTICLE_COUNT, lastBeatSpawnTime: 0, lastAmbientSpawnTime: 0, tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(), bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
      } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined') return;

        const { particles, material, geometry, positions, colors, velocities, lifetimes, spawnTimes, PARTICLE_COUNT, tempColor, bgColor } = webGLAssets as any;

        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (renderer) {
            renderer.autoClear = false;
            renderer.setClearColor((bgColor as THREE.Color).getHex(), 0.06); // For trails
            renderer.clear();
        }


        const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
        const sbnfHuesAmbient = [SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];

        const beatCooldown = 100;
        if (audioData.beat && (currentTime - (webGLAssets.lastBeatSpawnTime || 0) > beatCooldown)) {
            webGLAssets.lastBeatSpawnTime = currentTime;
            let burstParticlesToSpawn = Math.floor(PARTICLE_COUNT * (0.08 + audioData.bassEnergy * 0.25));
            burstParticlesToSpawn = Math.min(burstParticlesToSpawn, Math.floor(PARTICLE_COUNT * 0.12));
            let spawnedThisBeat = 0;

            for (let i = 0; i < PARTICLE_COUNT && spawnedThisBeat < burstParticlesToSpawn; i++) {
                if (lifetimes[i] <= 0) {
                    const pIdx = i * 3;
                    positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;

                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1.0);
                    const speed = 100 + Math.random() * 150 + audioData.bassEnergy * 200 + audioData.rms * 100;

                    velocities[pIdx]     = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);

                    const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
                    const [r, g, bVal] = hslToRgb(hue, 100, 50 + Math.random() * 20);
                    tempColor.setRGB(r, g, bVal);
                    colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;

                    lifetimes[i] = 0.7 + Math.random() * 1.0;
                    spawnTimes[i] = currentTime;
                    spawnedThisBeat++;
                }
            }
        }

        const ambientSpawnRate = 30 + audioData.rms * 80;
        const ambientSpawnInterval = 1000 / Math.max(1, ambientSpawnRate);
        if (currentTime - (webGLAssets.lastAmbientSpawnTime || 0) > ambientSpawnInterval) {
            webGLAssets.lastAmbientSpawnTime = currentTime;
            let spawnedAmbient = 0;
            const maxAmbientSpawn = Math.floor(PARTICLE_COUNT * 0.03);

            for (let i = 0; i < PARTICLE_COUNT && spawnedAmbient < maxAmbientSpawn; i++) {
                if (lifetimes[i] <= 0) {
                    const pIdx = i * 3;
                    positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;

                    const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1.0);
                    const speed = 20 + Math.random() * 30 + audioData.midEnergy * 50;

                    velocities[pIdx]     = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);

                    const hue = sbnfHuesAmbient[Math.floor(Math.random() * sbnfHuesAmbient.length)];
                    const [r, g, bVal] = hslToRgb(hue, 70 + Math.random() * 30, 40 + Math.random() * 20);
                    tempColor.setRGB(r, g, bVal);
                    colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;

                    lifetimes[i] = 1.5 + Math.random() * 1.5;
                    spawnTimes[i] = currentTime;
                    spawnedAmbient++;
                }
            }
        }

        const dragFactor = 0.98;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const pIdx = i * 3;
            if (lifetimes[i] > 0) {
                const ageMs = (currentTime - spawnTimes[i]);
                const initialLifetimeForRatioMs = (spawnTimes[i] + lifetimes[i] * 1000) - spawnTimes[i];

                lifetimes[i] -= deltaTime;

                if (lifetimes[i] <= 0) {
                    positions[pIdx + 1] = 100000; // Move far away
                    continue;
                }

                velocities[pIdx] *= dragFactor; velocities[pIdx + 1] *= dragFactor; velocities[pIdx + 2] *= dragFactor;
                positions[pIdx]     += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

                const lifeRatio = Math.max(0, lifetimes[i] / (initialLifetimeForRatioMs/1000 + 0.0001) );
                const fadeFactor = Math.pow(lifeRatio, 0.5);
                colors[pIdx] *= fadeFactor; colors[pIdx+1] *= fadeFactor; colors[pIdx+2] *= fadeFactor;
            } else {
                 positions[pIdx+1] = 100000;
                 colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0;
            }
        }

        if(geometry.attributes.position) (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        if(geometry.attributes.color) (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

        material.size = (1.8 + audioData.rms * 3.5) * Math.max(0.1, settings.brightCap);
        material.opacity = Math.max(0.1, settings.brightCap * (0.35 + audioData.rms * 0.40));
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.geometry) (webGLAssets.geometry as THREE.BufferGeometry).dispose();
            if (webGLAssets.material) (webGLAssets.material as THREE.PointsMaterial).dispose();
            if (webGLAssets.particles && webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(webGLAssets.particles as THREE.Points);
        }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    displayLabel: 'TUNNEL',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=TUNNEL&font=poppins', // SBNF Deep Purple BG, Orange-Red Text
    dataAiHint: 'geometric tunnel flight tron',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 50;

      const numSegments = 20;
      const segmentDepth = 100;
      const segmentRadius = 100;
      const segmentGeometry = new THREE.TorusGeometry(segmentRadius, 1.5, 8, 32); // Reduced tube thickness and segments for wireframe
      const segments: THREE.Mesh[] = [];

      for (let i = 0; i < numSegments; i++) {
        const material = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending });
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * segmentDepth;
        segment.rotation.x = Math.PI / 2;
        scene.add(segment);
        segments.push(segment);
      }

      return {
        scene, camera, segments, numSegments, segmentDepth, segmentSpeed: 120,
        cameraBaseFov: 75,
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // Tron uses black background
      } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.segments || !(webGLAssets.camera instanceof THREE.PerspectiveCamera) || !webGLAssets.cameraBaseFov || !webGLAssets.tempColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined' || !webGLAssets.bgColor) return;
        const { segments, segmentDepth, numSegments, segmentSpeed, cameraBaseFov, tempColor, bgColor } = webGLAssets as any;
        const camera = webGLAssets.camera as THREE.PerspectiveCamera;

        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (renderer) {
          renderer.setClearColor((bgColor as THREE.Color).getHex(), 1);
        }


        const tronHues = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed]; // Cyan and Orange for Tron

        segments.forEach((segment: THREE.Mesh, i: number) => {
            segment.position.z += segmentSpeed * (1 + audioData.rms * 1.0 + (audioData.beat ? 0.3 : 0)) * deltaTime;
            if (segment.position.z > camera.position.z + segmentDepth / 2) {
                segment.position.z -= numSegments * segmentDepth;
            }

            let baseHue = tronHues[(i + Math.floor(currentTime * 0.0005)) % tronHues.length];
            if(audioData.beat && i % 4 === 0) { // Flash some segments orange on beat
                baseHue = SBNF_HUES_SCENE.orangeRed;
            }

            const audioInfluence = ((audioData.spectrum[i % audioData.spectrum.length] || 0) / 255) * 20; // Less hue shift
            let targetHue = (baseHue + audioInfluence) % 360;
            let saturation = 90 + Math.random()*10;
            let lightness = 0.4 + audioData.rms * 0.15 + settings.brightCap * 0.1;
            lightness = Math.min(0.65, lightness); // Cap max lightness for wireframe

            const [r, g, bVal] = hslToRgb(targetHue, saturation, lightness * 100);
            tempColor.setRGB(r, g, bVal);
            if (segment.material instanceof THREE.MeshBasicMaterial) {
                segment.material.color.lerp(tempColor, 0.2); // Faster color lerp for Tron pulse
                segment.material.opacity = Math.min(0.8, 0.5 + audioData.rms * 0.3 + settings.brightCap * 0.1);
            }

            segment.rotation.z += (audioData.trebleEnergy * 0.015 + 0.0005 + audioData.bpm * 0.00001) * (i % 2 === 0 ? 1 : -1) * deltaTime * 60;
            segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0003 + i * 0.5) * audioData.midEnergy * 0.3;
        });

        camera.fov = cameraBaseFov - audioData.rms * 20 * settings.gamma + (audioData.beat ? 5 : 0) ;
        camera.fov = Math.max(60, Math.min(85, camera.fov));
        camera.updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets && webGLAssets.segments && webGLAssets.scene) {
        (webGLAssets.segments as THREE.Mesh[]).forEach(segment => {
            if (segment.geometry) segment.geometry.dispose();
            if (segment.material) (segment.material as THREE.Material).dispose();
            (webGLAssets.scene as THREE.Scene).remove(segment);
        });
        (webGLAssets as any).segments = [];
      }
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    displayLabel: 'STROBE',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=STROBE&font=poppins', // SBNF Cream BG, Black Text
    dataAiHint: 'strobe light flash',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(SBNF_HUES_SCENE.black),
        transparent: true,
        opacity: 1
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(planeMesh);

      return {
        scene, camera, planeMesh,  planeMaterial, tempColor: new THREE.Color(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        lastFrameTimeWebGL: performance.now(),
      } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.planeMesh || !webGLAssets.planeMaterial || !webGLAssets.tempColor || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined') return;
      const { planeMaterial, tempColor, bgColor } = webGLAssets as any;

      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (renderer) {
        renderer.setClearColor((bgColor as THREE.Color).getHex(), 1.0);
      }


      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
        const lightness = 70 + Math.random() * 25;

        const [r,g,bVal] = hslToRgb(hue, 100, lightness);
        tempColor.setRGB(r,g,bVal);
        (planeMaterial as THREE.MeshBasicMaterial).color.copy(tempColor);
        (planeMaterial as THREE.MeshBasicMaterial).opacity = Math.min(1, settings.brightCap * 1.0);
      } else {
        (planeMaterial as THREE.MeshBasicMaterial).opacity = Math.max(0, (planeMaterial as THREE.MeshBasicMaterial).opacity - deltaTime * 10.0);
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.planeMesh?.geometry) (webGLAssets.planeMesh.geometry as THREE.PlaneGeometry).dispose();
        if (webGLAssets.planeMaterial) (webGLAssets.planeMaterial as THREE.MeshBasicMaterial).dispose();
        if(webGLAssets.scene && webGLAssets.planeMesh) (webGLAssets.scene as THREE.Scene).remove(webGLAssets.planeMesh as THREE.Mesh);
      }
    }
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    displayLabel: 'FINALE',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=FINALE&font=poppins', // SBNF Mustard Gold BG, Deep Purple text
    dataAiHint: 'cosmic explosion stars fireworks',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 300;

      const PARTICLE_COUNT = 3000; // Reduced from 3500
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT);
      const spawnTimes = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
          lifetimes[i] = 0;
          const pIdx = i * 3;
          positions[pIdx + 1] = 100000; // Move off-screen initially
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 1.6, // Reduced base size
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      return {
        scene, camera, particles, material, geometry, positions, colors, velocities, lifetimes, spawnTimes,
        PARTICLE_COUNT, lastBeatTime: 0, tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(), bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        rotationSpeed: new THREE.Vector3(0.006, 0.008, 0.003),
      } as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTimeWebGL === 'undefined') return;

        const { particles, material, geometry, positions, colors, velocities, lifetimes, spawnTimes, PARTICLE_COUNT, tempColor, bgColor, rotationSpeed } = webGLAssets as any;

        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (renderer) {
            renderer.autoClear = false;
            renderer.setClearColor((bgColor as THREE.Color).getHex(), 0.06); // Slightly faster fade for clarity with fewer particles
            renderer.clear();
        }

        const beatCooldown = 180;
        const sbnfHuesFinale = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender];

        if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            let particlesToSpawn = Math.floor(PARTICLE_COUNT * (0.20 + audioData.bassEnergy * 0.08 + audioData.rms * 0.04)); // Reduced multipliers
            particlesToSpawn = Math.min(particlesToSpawn, Math.floor(PARTICLE_COUNT * 0.25)); // Max 25% per burst
            let spawnedCount = 0;

            for (let i = 0; i < PARTICLE_COUNT && spawnedCount < particlesToSpawn; i++) {
                if (lifetimes[i] <= 0) {
                    const pIdx = i * 3;
                    positions[pIdx] = (Math.random() - 0.5) * 10;
                    positions[pIdx + 1] = (Math.random() - 0.5) * 10;
                    positions[pIdx + 2] = (Math.random() - 0.5) * 10;

                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1.0);
                    const speed = 120 + Math.random() * 160 + audioData.bassEnergy * 150 + audioData.rms * 80; // Slightly reduced speed impact

                    velocities[pIdx]     = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);

                    const hue = sbnfHuesFinale[Math.floor(Math.random() * sbnfHuesFinale.length)];
                    const baseLightness = 45 + Math.random() * 15; // Range 45-60, less bright
                    const lightnessVariation = (audioData.beat ? 5 : 0) + (audioData.rms * 10);
                    const finalLightness = Math.min(70, baseLightness + lightnessVariation); // Capped max lightness
                    const [r,g,bVal] = hslToRgb(hue, 90 + Math.random() * 10, finalLightness);
                    tempColor.setRGB(r,g,bVal);
                    colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;

                    lifetimes[i] = 1.4 + Math.random() * 0.8;
                    spawnTimes[i] = currentTime;
                    spawnedCount++;
                }
            }
        }

        const dragFactor = 0.982;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
             const pIdx = i * 3;
            if (lifetimes[i] > 0) {
                const ageMs = (currentTime - spawnTimes[i]);
                const initialLifetimeForRatioS = (spawnTimes[i]/1000 + lifetimes[i]) - (spawnTimes[i]/1000) ;

                lifetimes[i] -= deltaTime;

                if (lifetimes[i] <= 0) {
                    positions[pIdx + 1] = 100000;
                    velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0;
                    colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0;
                    continue;
                }

                velocities[pIdx] *= dragFactor; velocities[pIdx + 1] *= dragFactor; velocities[pIdx + 2] *= dragFactor;
                positions[pIdx]     += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

                const lifeRatio = Math.max(0, lifetimes[i] / (initialLifetimeForRatioS + 0.0001));
                const fadeFactor = Math.pow(lifeRatio, 0.5);
                colors[pIdx] *= fadeFactor; colors[pIdx+1] *= fadeFactor; colors[pIdx+2] *= fadeFactor;
            } else {
                 positions[pIdx+1] = 100000;
                 colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0;
            }
        }

        if(geometry.attributes.position) (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        if(geometry.attributes.color) (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

        material.size = (1.5 + audioData.rms * 2.0) * Math.max(0.1, settings.brightCap); // Reduced size impact
        material.opacity = Math.max(0.1, settings.brightCap * (0.20 + audioData.rms * 0.40)); // Reduced opacity impact

        if (particles && rotationSpeed && webGLAssets.camera instanceof THREE.PerspectiveCamera) {
            (particles as THREE.Points).rotation.x += (rotationSpeed as THREE.Vector3).x * deltaTime * (0.1 + audioData.midEnergy * 0.4);
            (particles as THREE.Points).rotation.y += (rotationSpeed as THREE.Vector3).y * deltaTime * (0.1 + audioData.trebleEnergy * 0.4);

            const camera = webGLAssets.camera as THREE.PerspectiveCamera;
            camera.fov = 75 + audioData.rms * 1; // Less drastic FOV change
            camera.fov = Math.max(74, Math.min(76, camera.fov));
            camera.updateProjectionMatrix();
            camera.position.z = 300 - audioData.rms * 10; // Less drastic zoom
        }
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.geometry) (webGLAssets.geometry as THREE.BufferGeometry).dispose();
            if (webGLAssets.material) (webGLAssets.material as THREE.PointsMaterial).dispose();
            if (webGLAssets.particles && webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(webGLAssets.particles as THREE.Points);
        }
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";

// Utility function to draw procedural vines on an overlay canvas
export function drawProceduralVines(ctx: CanvasRenderingContext2D, vines: ProceduralVine[]) {
  if (!ctx || !vines || vines.length === 0) return;

  ctx.save();
  vines.forEach(vine => {
    if (vine.points.length < 2 || vine.opacity <= 0.01) return;

    ctx.beginPath();
    ctx.moveTo(vine.points[0].x, vine.points[0].y);
    for (let i = 1; i < vine.points.length; i++) {
      ctx.lineTo(vine.points[i].x, vine.points[i].y);
    }
    // Ensure color string has alpha component if opacity is not 1
    let strokeColor = vine.color;
    if (vine.opacity < 1.0) {
        // Basic check for HSL/RGB and convert to HSLA/RGBA
        if (strokeColor.startsWith('hsl(')) {
            strokeColor = strokeColor.replace('hsl(', 'hsla(').replace(')', `, ${vine.opacity.toFixed(2)})`);
        } else if (strokeColor.startsWith('rgb(')) {
            strokeColor = strokeColor.replace('rgb(', 'rgba(').replace(')', `, ${vine.opacity.toFixed(2)})`);
        } else if (strokeColor.startsWith('#') && strokeColor.length === 7) { // hex color #RRGGBB
            const r = parseInt(strokeColor.slice(1, 3), 16);
            const g = parseInt(strokeColor.slice(3, 5), 16);
            const b = parseInt(strokeColor.slice(5, 7), 16);
            strokeColor = `rgba(${r}, ${g}, ${b}, ${vine.opacity.toFixed(2)})`;
        } else if (strokeColor.startsWith('#') && strokeColor.length === 4) { // short hex #RGB
            const r = parseInt(strokeColor.slice(1, 2) + strokeColor.slice(1, 2), 16);
            const g = parseInt(strokeColor.slice(2, 3) + strokeColor.slice(2, 3), 16);
            const b = parseInt(strokeColor.slice(3, 4) + strokeColor.slice(3, 4), 16);
            strokeColor = `rgba(${r}, ${g}, ${b}, ${vine.opacity.toFixed(2)})`;
        }
        // Other color formats would need more sophisticated parsing or a library
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(0.5, vine.thickness);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  });
  ctx.restore();
}

    