
import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets, ProceduralVine } from '@/types';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

export const FFT_SIZES = [128, 256, 512] as const;

// SBNF Palette HSL (from the branding guide)
const SBNF_HUES_SCENE = {
  black: 0, // #000000
  orangeRed: 13, // #FF441A (Primary for SBNF)
  orangeYellow: 36, // #FDB143 (Accent for SBNF)
  lightPeach: 30, // #FFECDA (Foreground for SBNF)
  lightLavender: 267, // #E1CCFF (Accent 2 for SBNF)
  deepPurple: 258, // #5A36BB (Background for SBNF)
  // For Tron-like effects or cool accents
  tronBlue: 197, // A bright cyan/blue
  tronPink: 337, // A vibrant pink/magenta
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

    // Simple pseudo-random noise
    let val = 0;
    for(let octave = 0; octave < 4; octave++) { // 4 octaves of noise
        const freq = Math.pow(2, octave);
        const amp = Math.pow(0.5, octave);
        val += Math.sin(x * Math.PI * freq * 5 + Math.random() * 0.2) * amp;
        val += Math.cos(y * Math.PI * freq * 7 + Math.random() * 0.3) * amp;
    }
    val = (val / 1.5 + 1) / 2; // Normalize, biased towards middle range

    const value = Math.floor(val * 180) + 75; // Brighter noise, 75-255 range, more mid-tones
    data[stride] = value;
    data[stride + 1] = value;
    data[stride + 2] = value;
    data[stride + 3] = 255; // Opaque alpha
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
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
  showWebcam: false, // Default to false, user explicitly enables
  mirrorWebcam: true,
  currentSceneId: 'radial_burst', // Default SBNF scene
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse', // SBNF default animation
    speed: 1,
    color: '#FF441A', // SBNF Orange-Red
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500,
  sceneTransitionActive: true,
  monitorAudio: false,
  selectedAudioInputDeviceId: undefined,
  enableAiOverlay: false, // Default to false, user explicitly enables
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent", // SBNF themed default
  enablePeriodicAiOverlay: false, // Periodic AI updates off by default
  aiOverlayRegenerationInterval: 45, // Default to 45s
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins', // SBNF Purple bg, Peach text
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      // Orthographic camera is better for full-screen plane effects
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const webGLAssets: Partial<WebGLSceneAssets> & {
        lastCanvasWidth?: number,
        lastCanvasHeight?: number,
        noiseTexture?: THREE.DataTexture,
        vinesData?: { activeVines: ProceduralVine[], nextVineId: number, lastSpawnTime: number, spawnCooldown: number, maxVines: number },
        GRAPE_COUNT?: number;
        lastGrapeSpawnTime?: number;
        grapeInitialLifetimes?: Float32Array;
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
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.08), // Darker SBNF purple for background
      };

      if (webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0) {
        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.NearestFilter; // Performance optimization
        videoTexture.magFilter = THREE.NearestFilter; // Performance optimization
        videoTexture.generateMipmaps = false;       // Performance optimization
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
          varying vec2 vUv;

          // Simplified Fresnel approximation for a full-screen quad/plane
          float fresnelApprox(vec2 uv_coords, float power) {
            float edgeFactorX = pow(1.0 - 2.0 * abs(uv_coords.x - 0.5), power);
            float edgeFactorY = pow(1.0 - 2.0 * abs(uv_coords.y - 0.5), power);
            return clamp(edgeFactorX + edgeFactorY, 0.0, 1.0);
          }

          void main() {
            // Optional: Throttle shader work for performance on low-end GPUs
            if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard;

            vec4 webcamColor = texture2D(u_webcamTexture, vUv);
            float luma = dot(webcamColor.rgb, vec3(0.299, 0.587, 0.114));
            float silhouetteMask = smoothstep(0.25, 0.55, luma);

            vec2 noiseUv = vUv * 2.5 + vec2(u_time * 0.04, u_time * 0.025);
            vec3 noiseVal = texture2D(u_noiseTexture, noiseUv).rgb;
            vec3 dynamicFill = mix(u_fillColor1, u_fillColor2, noiseVal.r);

            float rim = fresnelApprox(vUv, 3.0);
            vec3 finalColor = mix(dynamicFill, u_rimColor, rim * 0.85);

            // If checkerboard discard is active, compensate alpha slightly
            float alphaCompensation = 1.85; // Was 1.85 - adjust as needed for visual balance
            float finalAlpha = silhouetteMask * u_opacityFactor * webcamColor.a * alphaCompensation;

            gl_FragColor = vec4(finalColor, clamp(finalAlpha, 0.0, 1.0));
          }
        `;
        const shaderMaterial = new THREE.ShaderMaterial({
          vertexShader, fragmentShader,
          uniforms: {
            u_webcamTexture: { value: videoTexture },
            u_noiseTexture: { value: webGLAssets.noiseTexture },
            u_rimColor: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeYellow / 360, 0.98, 0.63) },
            u_fillColor1: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.47) },
            u_fillColor2: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.lightLavender / 360, 1.0, 0.90) },
            u_opacityFactor: { value: 1.0 },
            u_mirrorX: { value: settings.mirrorWebcam },
            u_time: { value: 0.0 },
            u_resolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
          },
          transparent: true, depthWrite: false,
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
        const grapeInitialLifetimes = new Float32Array(GRAPE_COUNT); // Store initial lifetime for accurate age calc

        for (let i = 0; i < GRAPE_COUNT; i++) grapeLifetimes[i] = 0; // Start dead

        const grapeGeometry = new THREE.BufferGeometry();
        grapeGeometry.setAttribute('position', new THREE.BufferAttribute(grapePositions, 3));
        grapeGeometry.setAttribute('color', new THREE.BufferAttribute(grapeColors, 3));
        grapeGeometry.setAttribute('size', new THREE.BufferAttribute(grapeCurrentSizes, 1));

        const grapeMaterial = new THREE.PointsMaterial({
          vertexColors: true,
          size: settings.brightCap * 2.5, // Base size, modulated by brightCap
          sizeAttenuation: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
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
        webGLAssets.grapeInitialLifetimes = grapeInitialLifetimes;


      } else {
        webGLAssets.planeMesh = undefined;
        webGLAssets.videoTexture = undefined;
        webGLAssets.shaderMaterial = undefined;
      }
      return webGLAssets as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      const { planeMesh, shaderMaterial, videoTexture, bgColor,
              grapes, grapeGeometry, grapeMaterial, grapePositions, grapeColors, grapeTargetSizes,
              grapeCurrentSizes, grapeLifetimes, grapeSpawnTimes, GRAPE_COUNT, tempColor,
              grapeInitialLifetimes, vinesData
      } = webGLAssets as any;

      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (bgColor) renderer.setClearColor(bgColor, 1);
      renderer.clear();

      if (planeMesh && shaderMaterial && videoTexture && settings.showWebcam && webcamElement?.readyState >= webcamElement.HAVE_ENOUGH_DATA) {
        if (webGLAssets.lastCanvasWidth !== canvasWidth || webGLAssets.lastCanvasHeight !== canvasHeight) {
            if (planeMesh.geometry) planeMesh.geometry.dispose();
            planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
            (camera as THREE.OrthographicCamera).left = -canvasWidth / 2; (camera as THREE.OrthographicCamera).right = canvasWidth / 2;
            (camera as THREE.OrthographicCamera).top = canvasHeight / 2; (camera as THREE.OrthographicCamera).bottom = -canvasHeight / 2;
            camera.updateProjectionMatrix();
            shaderMaterial.uniforms.u_resolution.value.set(canvasWidth, canvasHeight);
            webGLAssets.lastCanvasWidth = canvasWidth;
            webGLAssets.lastCanvasHeight = canvasHeight;
        }
        if (videoTexture.image !== webcamElement) videoTexture.image = webcamElement;
        videoTexture.needsUpdate = true;

        shaderMaterial.uniforms.u_time.value = currentTime * 0.001;
        shaderMaterial.uniforms.u_mirrorX.value = settings.mirrorWebcam;
        const baseOpacity = settings.brightCap * (0.7 + audioData.rms * 0.5);
        shaderMaterial.uniforms.u_opacityFactor.value = Math.min(1.0, baseOpacity);

        const hueTimeShift = (currentTime / 15000) * 360;
        shaderMaterial.uniforms.u_rimColor.value.setHSL(
          ((SBNF_HUES_SCENE.orangeYellow + audioData.trebleEnergy * 60 + hueTimeShift) % 360) / 360,
          0.98,
          0.65 + (audioData.beat ? 0.1 : 0) // Brighter on beat
        );
        shaderMaterial.uniforms.u_fillColor1.value.setHSL(
          ((SBNF_HUES_SCENE.deepPurple + audioData.bassEnergy * 40 + hueTimeShift * 0.8) % 360) / 360,
          0.6,
          0.3 + audioData.midEnergy * 0.25
        );
        shaderMaterial.uniforms.u_fillColor2.value.setHSL(
          ((SBNF_HUES_SCENE.lightLavender + audioData.midEnergy * 50 + hueTimeShift * 1.2) % 360) / 360,
          0.9,
          0.5 + audioData.trebleEnergy * 0.3
        );
        planeMesh.visible = true;
      } else {
        if (planeMesh) planeMesh.visible = false;
      }

      // Grape particles logic
      if (grapes && grapeLifetimes && grapePositions && grapeColors && grapeCurrentSizes && grapeTargetSizes && grapeSpawnTimes && tempColor && GRAPE_COUNT && grapeMaterial) {
        const beatCooldown = 150;
        let spawnedThisFrameGrapes = 0;
        const maxSpawnPerBeatGrapes = Math.floor(GRAPE_COUNT * 0.15);

        if (audioData.beat && (currentTime - (webGLAssets.lastGrapeSpawnTime || 0) > beatCooldown)) {
            webGLAssets.lastGrapeSpawnTime = currentTime;
            let grapesToSpawnCount = Math.floor(GRAPE_COUNT * (0.05 + audioData.bassEnergy * 0.2));
            grapesToSpawnCount = Math.min(grapesToSpawnCount, maxSpawnPerBeatGrapes);

            for (let i = 0; i < GRAPE_COUNT && spawnedThisFrameGrapes < grapesToSpawnCount; i++) {
                if (grapeLifetimes[i] <= 0) {
                    const pIdx = i * 3;
                    grapePositions[pIdx] = (Math.random() - 0.5) * canvasWidth * 0.6;
                    grapePositions[pIdx + 1] = (Math.random() - 0.5) * canvasHeight * 0.6;
                    grapePositions[pIdx + 2] = (Math.random() - 0.5) * 30;

                    const initialLife = 1.5 + Math.random() * 1.5;
                    grapeLifetimes[i] = initialLife;
                    grapeInitialLifetimes[i] = initialLife;
                    grapeSpawnTimes[i] = currentTime;

                    const initialColorHue = SBNF_HUES_SCENE.lightLavender;
                    const [r,g,b] = hslToRgb(initialColorHue, 80 + Math.random()*20, 60 + Math.random()*10);
                    grapeColors[pIdx] = r; grapeColors[pIdx + 1] = g; grapeColors[pIdx + 2] = b;

                    grapeTargetSizes[i] = (15 + audioData.bassEnergy * 40 + Math.random() * 10) * Math.max(0.5, settings.brightCap);
                    grapeCurrentSizes[i] = 0.1;
                    spawnedThisFrameGrapes++;
                }
            }
        }

        for (let i = 0; i < GRAPE_COUNT; i++) {
            if (grapeLifetimes[i] > 0) {
                const pIdx = i * 3;
                grapeLifetimes[i] -= deltaTime;

                const ageMs = currentTime - grapeSpawnTimes[i];
                const lifeRatio = Math.max(0, Math.min(1, ageMs / (grapeInitialLifetimes[i] * 1000 + 0.01) ));

                const startHue = SBNF_HUES_SCENE.lightLavender;
                const endHue = SBNF_HUES_SCENE.orangeRed;
                const currentHue = startHue + (endHue - startHue) * lifeRatio;
                const currentSaturation = 90 + (100 - 90) * lifeRatio;
                const currentLightness = 65 + (55 - 65) * lifeRatio;
                const [r,g,b] = hslToRgb(currentHue, currentSaturation, currentLightness);
                grapeColors[pIdx] = r; grapeColors[pIdx + 1] = g; grapeColors[pIdx + 2] = b;

                const popDurationMs = 300;
                if (ageMs < popDurationMs) {
                    grapeCurrentSizes[i] = Math.min(grapeTargetSizes[i], (ageMs / popDurationMs) * grapeTargetSizes[i]);
                } else {
                    const remainingLifetimeRatio = Math.max(0, grapeLifetimes[i] / (grapeInitialLifetimes[i] - (popDurationMs / 1000) + 0.01));
                    grapeCurrentSizes[i] = grapeTargetSizes[i] * Math.pow(remainingLifetimeRatio, 2);
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
      }

      // Procedural Vines (data management)
      if (vinesData && canvasWidth > 0 && canvasHeight > 0) {
        const { activeVines, spawnCooldown, maxVines } = vinesData;
        const hueTimeShift = (currentTime / 10000) * 360;
        if (audioData.midEnergy > 0.35 && currentTime - (vinesData.lastSpawnTime || 0) > spawnCooldown && activeVines.length < maxVines) {
          vinesData.lastSpawnTime = currentTime;
          vinesData.nextVineId = (vinesData.nextVineId || 0) + 1;
          const newVine: ProceduralVine = {
            id: vinesData.nextVineId, points: [],
            color: `hsla(${(SBNF_HUES_SCENE.lightLavender + Math.random() * 60 - 30 + hueTimeShift)%360}, 70%, 65%, 0.7)`,
            opacity: 0.7, currentLength: 0, maxLength: 150 + Math.random() * 150,
            spawnTime: currentTime, lifetime: 2000 + Math.random() * 2000,
            thickness: 1 + audioData.midEnergy * 2, curlFactor: 0.03 + Math.random() * 0.04,
            angle: Math.random() * Math.PI * 2,
            startX: Math.random() < 0.5 ? (Math.random() < 0.5 ? 5 : canvasWidth - 5) : Math.random() * canvasWidth,
            startY: Math.random() < 0.5 ? (Math.random() < 0.5 ? 5 : canvasHeight - 5) : Math.random() * canvasHeight,
            speed: 0.5 + audioData.midEnergy * 1.0,
          };
          newVine.points.push({ x: newVine.startX, y: newVine.startY });
          activeVines.push(newVine);
        }
        for (let i = activeVines.length - 1; i >= 0; i--) {
          const vine = activeVines[i];
          const age = currentTime - vine.spawnTime;
          if (age > vine.lifetime) { activeVines.splice(i, 1); continue; }
          vine.opacity = Math.max(0, 0.7 * (1 - age / vine.lifetime));
          vine.thickness = Math.max(0.5, (1 + audioData.midEnergy * 2) * (1 - age / vine.lifetime));
          if (vine.currentLength < vine.maxLength && vine.points.length > 0) {
            const lastPoint = vine.points[vine.points.length - 1];
            const curlInfluence = 0.05 + audioData.trebleEnergy * 0.2;
            const baseCurl = Math.sin(currentTime * 0.0005 * vine.curlFactor + vine.id + vine.points.length * 0.1) * Math.PI * curlInfluence;
            const randomWiggle = (Math.random() - 0.5) * 0.1 * (1 + audioData.trebleEnergy);
            vine.angle += baseCurl * (deltaTime * 50) + randomWiggle;

            const segmentLength = vine.speed * 1.5 * (1 + audioData.rms * 0.5);
            let nextX = lastPoint.x + Math.cos(vine.angle) * segmentLength;
            let nextY = lastPoint.y + Math.sin(vine.angle) * segmentLength;

            if (nextX <= 0 || nextX >= canvasWidth) { vine.angle = Math.PI - vine.angle + (Math.random() - 0.5) * 0.5; nextX = Math.max(1, Math.min(canvasWidth - 1, nextX)); }
            if (nextY <= 0 || nextY >= canvasHeight) { vine.angle = -vine.angle + (Math.random() - 0.5) * 0.5; nextY = Math.max(1, Math.min(canvasHeight - 1, nextY)); }

            vine.points.push({ x: nextX, y: nextY });
            vine.currentLength += segmentLength;
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
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes&font=poppins', // SBNF OrangeRed bg, Peach text
    dataAiHint: 'glowing orbs abstract shapes',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const circleGeometry = new THREE.CircleGeometry(50, 32);
      const squareGeometry = new THREE.PlaneGeometry(100, 100);
      const triangleShape = new THREE.Shape();
      triangleShape.moveTo(-50, -43.3); triangleShape.lineTo(50, -43.3);
      triangleShape.lineTo(0, 43.3); triangleShape.lineTo(-50, -43.3);
      const triangleGeometry = new THREE.ShapeGeometry(triangleShape);

      return {
        scene, camera,
        geometries: [circleGeometry, squareGeometry, triangleGeometry],
        activeShapes: [],
        spawnCooldown: 100,
        lastSpawnTime: 0,
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.05),
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { geometries, activeShapes, spawnCooldown, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (bgColor) renderer.setClearColor(bgColor, 0.15);

        const shouldSpawn = (audioData.beat && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown / 2)) ||
                            (audioData.rms > 0.15 && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown));

        if (shouldSpawn && activeShapes.length < 50) {
            webGLAssets.lastSpawnTime = currentTime;
            const geometry = geometries[Math.floor(Math.random() * geometries.length)];
            const material = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0.0,
                side: THREE.DoubleSide,
            });

            const [r,g,b] = hslToRgb(
                (SBNF_HUES_SCENE.lightLavender + Math.random() * 60 - 30 + (currentTime/100)) % 360,
                70 + audioData.trebleEnergy * 30,
                50 + audioData.midEnergy * 25
            );
            material.color.setRGB(r,g,b);

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (Math.random() - 0.5) * canvasWidth * 0.8,
                (Math.random() - 0.5) * canvasHeight * 0.8,
                0
            );
            mesh.rotation.z = Math.random() * Math.PI * 2;

            const initialScale = 0.1 + audioData.bassEnergy * 0.5;
            mesh.scale.set(initialScale, initialScale, initialScale);

            activeShapes.push({
                mesh,
                lifetime: 2.0 + Math.random() * 2.0,
                initialScale,
                maxScale: initialScale * (1.5 + audioData.rms * 2.0),
                currentOpacity: 0,
                targetOpacity: Math.min(1.0, 0.3 + audioData.rms * 0.7) * settings.brightCap,
                rotationSpeed: (Math.random() - 0.5) * 0.5 * (1 + audioData.bpm / 120),
                spawnTime: currentTime,
            });
            scene.add(mesh);
        }

        for (let i = activeShapes.length - 1; i >= 0; i--) {
            const shape = activeShapes[i];
            shape.lifetime -= deltaTime;

            if (shape.lifetime <= 0) {
                scene.remove(shape.mesh);
                shape.mesh.material.dispose(); // Shape geometry is shared
                activeShapes.splice(i, 1);
                continue;
            }

            const fadeInDuration = 0.3;
            if ((currentTime - shape.spawnTime)/1000 < fadeInDuration) {
                 shape.currentOpacity = Math.min(shape.targetOpacity, shape.targetOpacity * (((currentTime - shape.spawnTime)/1000) / fadeInDuration) );
            } else if (shape.lifetime < 0.5) {
                shape.currentOpacity = shape.targetOpacity * (shape.lifetime / 0.5);
            } else {
                shape.currentOpacity = shape.targetOpacity;
            }
            shape.mesh.material.opacity = Math.max(0, shape.currentOpacity);

            const lifeRatio = 1.0 - (shape.lifetime / (shape.mesh.userData.initialLifetime || 2.5)); // Use stored or default
            const scaleProgress = Math.min(1, lifeRatio * 2);
            const currentScale = shape.initialScale + (shape.maxScale - shape.initialScale) * Math.sin(scaleProgress * Math.PI * 0.5);
            shape.mesh.scale.set(currentScale, currentScale, currentScale);
            shape.mesh.rotation.z += shape.rotationSpeed * deltaTime;
            shape.mesh.userData.initialLifetime = shape.mesh.userData.initialLifetime || (2.0 + Math.random()*2.0);
        }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        webGLAssets.activeShapes?.forEach((shape: any) => {
            if (shape.mesh) {
                if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(shape.mesh);
                if(shape.mesh.material) shape.mesh.material.dispose();
            }
        });
        webGLAssets.activeShapes = [];
        webGLAssets.geometries?.forEach((geom: THREE.BufferGeometry) => geom.dispose());
        webGLAssets.geometries = [];
      }
    }
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings&font=poppins', // SBNF OrangeYellow bg, Black text
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const ringGeometry = new THREE.RingGeometry(1, 1.05, 64, 1, 0, Math.PI * 2); // Slightly thicker rings

      return {
        scene, camera,
        ringGeometry,
        activeBassRings: [],
        activeMidRings: [],
        activeTrebleRings: [],
        spawnCooldown: 50,
        lastSpawnTimes: [0,0,0],
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.03),
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { ringGeometry, activeBassRings, activeMidRings, activeTrebleRings, spawnCooldown, lastSpawnTimes, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (bgColor) renderer.setClearColor(bgColor, 0.2);

        const bandData = [
            { rings: activeBassRings, energy: audioData.bassEnergy, colorHue: SBNF_HUES_SCENE.orangeRed, spawnIdx: 0 },
            { rings: activeMidRings, energy: audioData.midEnergy, colorHue: SBNF_HUES_SCENE.orangeYellow, spawnIdx: 1 },
            { rings: activeTrebleRings, energy: audioData.trebleEnergy, colorHue: SBNF_HUES_SCENE.lightLavender, spawnIdx: 2 },
        ];

        bandData.forEach(band => {
            if (band.energy > 0.15 && (currentTime - lastSpawnTimes[band.spawnIdx] > spawnCooldown / (1 + band.energy * 5)) && band.rings.length < 20) {
                lastSpawnTimes[band.spawnIdx] = currentTime;

                const material = new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: 0,
                    side: THREE.DoubleSide,
                });
                const [r,g,b] = hslToRgb( (band.colorHue + (Math.random() * 30 - 15) + (currentTime/200)) % 360, 90 + band.energy * 10, 50 + band.energy * 25 );
                material.color.setRGB(r,g,b);

                const mesh = new THREE.Mesh(ringGeometry, material);
                mesh.scale.set(0.1, 0.1, 1);
                const ringData = {
                    mesh,
                    lifetime: 1.0 + band.energy * 1.5,
                    initialScale: 0.1,
                    maxScale: (Math.min(canvasWidth, canvasHeight) * 0.45) * (0.5 + band.energy * 0.8),
                    targetOpacity: Math.min(0.8, 0.3 + band.energy * 0.7) * settings.brightCap,
                    currentOpacity: 0,
                    spawnTime: currentTime,
                };
                band.rings.push(ringData);
                scene.add(mesh);
            }

            for (let i = band.rings.length - 1; i >= 0; i--) {
                const ring = band.rings[i];
                ring.lifetime -= deltaTime;

                if (ring.lifetime <= 0) {
                    scene.remove(ring.mesh);
                    ring.mesh.material.dispose();
                    band.rings.splice(i, 1);
                    continue;
                }
                const lifeRatio = 1.0 - (ring.lifetime / (ring.mesh.userData.initialLifetime || (1.0 + band.energy * 1.5)));
                ring.mesh.userData.initialLifetime = ring.mesh.userData.initialLifetime || (1.0 + band.energy * 1.5);


                const fadeInDuration = 0.2;
                if ((currentTime - ring.spawnTime)/1000 < fadeInDuration) {
                    ring.currentOpacity = Math.min(ring.targetOpacity, ring.targetOpacity * (((currentTime - ring.spawnTime)/1000) / fadeInDuration) );
                } else if (ring.lifetime < 0.3) {
                    ring.currentOpacity = ring.targetOpacity * (ring.lifetime / 0.3);
                } else {
                    ring.currentOpacity = ring.targetOpacity;
                }
                ring.mesh.material.opacity = Math.max(0, ring.currentOpacity);

                const currentScale = ring.initialScale + (ring.maxScale - ring.initialScale) * lifeRatio;
                ring.mesh.scale.set(currentScale, currentScale, 1);
            }
        });
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        ['activeBassRings', 'activeMidRings', 'activeTrebleRings'].forEach(ringArrayName => {
            webGLAssets[ringArrayName]?.forEach((ring: any) => {
                if (ring.mesh) {
                    if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(ring.mesh);
                    if(ring.mesh.material) ring.mesh.material.dispose();
                }
            });
            webGLAssets[ringArrayName] = [];
        });
        if (webGLAssets.ringGeometry) (webGLAssets.ringGeometry as THREE.RingGeometry).dispose();
      }
    }
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins', // SBNF Lavender bg, Purple text
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const GRID_SIZE_X = 16; // Reduced for potentially better performance and larger cells
      const GRID_SIZE_Y = Math.round(GRID_SIZE_X * (canvas.height / canvas.width));
      const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

      const cellGeometry = new THREE.PlaneGeometry(1, 1);
      const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, totalCells);
      scene.add(instancedMesh);

      const cellStates = [];
      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();

      const cellBaseWidth = canvas.width / GRID_SIZE_X;
      const cellBaseHeight = canvas.height / GRID_SIZE_Y;

      for (let y = 0; y < GRID_SIZE_Y; y++) {
        for (let x = 0; x < GRID_SIZE_X; x++) {
            const i = y * GRID_SIZE_X + x;
            dummy.position.set(
                (x - GRID_SIZE_X / 2 + 0.5) * cellBaseWidth,
                (y - GRID_SIZE_Y / 2 + 0.5) * cellBaseHeight,
                0
            );
            dummy.scale.set(cellBaseWidth * 0.85, cellBaseHeight * 0.85, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
            instancedMesh.setColorAt(i, tempColor.setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.6, 0.1));
            cellStates.push({
                targetHue: SBNF_HUES_SCENE.deepPurple,
                targetLightness: 0.1,
                currentLightness: 0.1,
                lastPulseTime: 0,
            });
        }
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.instanceColor!.needsUpdate = true;

      return {
        scene, camera, instancedMesh, cellStates, GRID_SIZE_X, GRID_SIZE_Y, totalCells,
        cellBaseWidth, cellBaseHeight, tempColor,
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.02),
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { instancedMesh, cellStates, GRID_SIZE_X, GRID_SIZE_Y, totalCells, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if(bgColor) renderer.setClearColor(bgColor, 0.1);

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;

        for (let i = 0; i < totalCells; i++) {
            const state = cellStates[i];
            const spectrumIndex = Math.floor((i / totalCells) * spectrumLength);
            const energy = (spectrum[spectrumIndex] || 0) / 255;

            if (energy > 0.2 && currentTime - state.lastPulseTime > 100) {
                state.lastPulseTime = currentTime;
                // Use SBNF colors for pulses
                const sbnfPulseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
                state.targetHue = (sbnfPulseHues[Math.floor(Math.random() * sbnfPulseHues.length)] + energy * 30 + (i * 5) + (currentTime/500)) % 360;
                state.targetLightness = 0.3 + energy * 0.4 * settings.brightCap;
            } else {
                state.targetLightness *= 0.97;
                state.targetLightness = Math.max(0.05, state.targetLightness);
            }
            state.currentLightness += (state.targetLightness - state.currentLightness) * 0.1;

            const [r,g,b] = hslToRgb(state.targetHue, 0.8 + energy * 0.2, state.currentLightness * 100);
            tempColor.setRGB(r,g,b);
            instancedMesh.setColorAt(i, tempColor);
        }
        instancedMesh.instanceColor!.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets && webGLAssets.instancedMesh) {
            (webGLAssets.instancedMesh as THREE.InstancedMesh).geometry.dispose();
            ((webGLAssets.instancedMesh as THREE.InstancedMesh).material as THREE.Material).dispose();
             if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(webGLAssets.instancedMesh as THREE.InstancedMesh);
        }
    }
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins', // SBNF Purple bg, OrangeYellow text
    dataAiHint: 'audio spectrum analysis',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const numBars = Math.floor((settings.fftSize / 2));
      const barBaseWidth = canvas.width / (numBars * 1.5);

      const barGeometry = new THREE.PlaneGeometry(1, 1);
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      scene.add(instancedMesh);

      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();

      for (let i = 0; i < numBars; i++) {
        const xPosition = (i - numBars / 2 + 0.5) * barBaseWidth * 1.5;
        dummy.position.set(xPosition, -canvas.height / 2, 0);
        dummy.scale.set(barBaseWidth, 1, 1);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, tempColor.setHSL(SBNF_HUES_SCENE.deepPurple/360, 0.6, 0.1));
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.instanceColor!.needsUpdate = true;

      return {
        scene, camera, instancedMesh, numBars, barBaseWidth, dummy, tempColor,
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.47), // SBNF Deep Purple
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { instancedMesh, numBars, barBaseWidth, dummy, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if(bgColor) renderer.setClearColor(bgColor, 1);

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;

        for (let i = 0; i < numBars; i++) {
            if (i >= spectrumLength) continue;

            const value = spectrum[i] / 255;
            const barHeight = Math.max(1, value * canvasHeight * 0.8 * settings.brightCap * (1 + audioData.rms * 0.5));

            const yPosition = -canvasHeight / 2 + barHeight / 2;
            const xPosition = (i - numBars / 2 + 0.5) * barBaseWidth * 1.5;

            dummy.position.set(xPosition, yPosition, 0);
            dummy.scale.set(barBaseWidth, barHeight, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            const hueShift = (currentTime / 8000 * 360 + i * 5) % 360;
            let baseHue = SBNF_HUES_SCENE.orangeRed;
            if (i > numBars * 0.33 && i <= numBars * 0.66) baseHue = SBNF_HUES_SCENE.orangeYellow;
            else if (i > numBars * 0.66) baseHue = SBNF_HUES_SCENE.lightLavender;

            const finalHue = (baseHue + hueShift + (audioData.beat ? 30 : 0)) % 360;
            const saturation = 0.7 + value * 0.3 + audioData.rms * 0.2;
            const lightness = 0.3 + value * 0.4 + audioData.rms * 0.2;

            const [r,g,b] = hslToRgb(finalHue, Math.min(1, saturation) * 100, Math.min(0.75, lightness) * 100);
            tempColor.setRGB(r,g,b);
            instancedMesh.setColorAt(i, tempColor);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.instanceColor!.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets && webGLAssets.instancedMesh) {
            (webGLAssets.instancedMesh as THREE.InstancedMesh).geometry.dispose();
            ((webGLAssets.instancedMesh as THREE.InstancedMesh).material as THREE.Material).dispose();
             if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(webGLAssets.instancedMesh as THREE.InstancedMesh);
        }
    }
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Burst&font=poppins', // SBNF OrangeRed bg, Peach text
    dataAiHint: 'particle explosion audio beat',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 300; // Zoom out a bit more

      const PARTICLE_COUNT = 4000; // Reduced from 5000
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT); // 0 = dead, >0 = alive

      for (let i = 0; i < PARTICLE_COUNT; i++) lifetimes[i] = 0; // Start all dead

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 5 * settings.brightCap, // Adjusted base size
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      return {
        scene, camera, particles, particleMaterial: material, particleGeometry: geometry,
        positions, colors, velocities, lifetimes, PARTICLE_COUNT,
        tempColor: new THREE.Color(), lastBeatTime: 0, lastAmbientSpawnTime: 0,
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.01), // Very dark SBNF
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const { particles, particleMaterial, particleGeometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor } = webGLAssets as any;
      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (bgColor) renderer.setClearColor(bgColor, 0.1); // Trail effect

      const beatCooldown = 100; // ms
      const ambientSpawnRate = 0.03; // Fraction of particles to spawn per second ambiently
      let spawnedThisFrame = 0;

      // Beat Burst
      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
        webGLAssets.lastBeatTime = currentTime;
        const maxBurstParticlesThisBeat = Math.floor(PARTICLE_COUNT * (0.08 + audioData.bassEnergy * 0.25)); // Reduced
        let burstSpawned = 0;
        for (let i = 0; i < PARTICLE_COUNT && burstSpawned < maxBurstParticlesThisBeat; i++) {
          if (lifetimes[i] <= 0) { // Find a dead particle
            const pIdx = i * 3;
            positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;

            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos((Math.random() * 2) - 1);
            const speed = 100 + (audioData.bassEnergy + audioData.rms) * 200 + Math.random() * 50;
            velocities[pIdx] = speed * Math.sin(theta) * Math.cos(phi);
            velocities[pIdx + 1] = speed * Math.sin(theta) * Math.sin(phi);
            velocities[pIdx + 2] = speed * Math.cos(theta);

            lifetimes[i] = 1.0 + Math.random() * 1.5; // Shorter lifetime for bursts
            // SBNF Burst Colors: Oranges, Yellows
            const burstHue = Math.random() < 0.7 ? SBNF_HUES_SCENE.orangeRed : SBNF_HUES_SCENE.orangeYellow;
            const [r,g,b] = hslToRgb(burstHue, 90 + Math.random() * 10, 50 + Math.random() * 20);
            colors[pIdx] = r; colors[pIdx + 1] = g; colors[pIdx + 2] = b;
            burstSpawned++;
            spawnedThisFrame++;
          }
        }
      }

      // Ambient Sparkle
      const numAmbientToSpawn = Math.floor(PARTICLE_COUNT * ambientSpawnRate * deltaTime * (0.2 + audioData.rms * 2));
      let ambientSpawned = 0;
      if(currentTime - webGLAssets.lastAmbientSpawnTime > 50 && audioData.rms > 0.05){ // Spawn ambient less frequently
        webGLAssets.lastAmbientSpawnTime = currentTime;
        for (let i = 0; i < PARTICLE_COUNT && ambientSpawned < numAmbientToSpawn && spawnedThisFrame < PARTICLE_COUNT * 0.1; i++) {
             if (lifetimes[i] <= 0) {
                const pIdx = i * 3;
                positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.acos((Math.random() * 2) - 1);
                const speed = 50 + audioData.rms * 100 + Math.random() * 20;
                velocities[pIdx] = speed * Math.sin(theta) * Math.cos(phi);
                velocities[pIdx + 1] = speed * Math.sin(theta) * Math.sin(phi);
                velocities[pIdx + 2] = speed * Math.cos(theta);
                lifetimes[i] = 2.0 + Math.random() * 2.0; // Longer lifetime for ambient
                // SBNF Ambient Colors: Purples, Lavenders
                const ambientHue = Math.random() < 0.6 ? SBNF_HUES_SCENE.deepPurple : SBNF_HUES_SCENE.lightLavender;
                const [r,g,b] = hslToRgb(ambientHue, 60 + Math.random() * 20, 30 + Math.random() * 20);
                colors[pIdx] = r; colors[pIdx + 1] = g; colors[pIdx + 2] = b;
                ambientSpawned++;
                spawnedThisFrame++;
            }
        }
      }


      const dragFactor = 0.97;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (lifetimes[i] > 0) {
          const pIdx = i * 3;
          positions[pIdx] += velocities[pIdx] * deltaTime;
          positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
          positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

          velocities[pIdx] *= dragFactor;
          velocities[pIdx + 1] *= dragFactor;
          velocities[pIdx + 2] *= dragFactor;

          lifetimes[i] -= deltaTime;
          const lifeRatio = Math.max(0, lifetimes[i] / (2.0 + Math.random()*2.0) ); // Approx initial lifetime
          // Darken color to fade
          const originalColor = tempColor.setRGB(colors[pIdx], colors[pIdx+1], colors[pIdx+2]);
          originalColor.multiplyScalar(Math.pow(lifeRatio, 1.5)); // Fade out
          colors[pIdx] = originalColor.r;
          colors[pIdx + 1] = originalColor.g;
          colors[pIdx + 2] = originalColor.b;
        } else {
            // Move dead particles off-screen
            positions[pIdx] = 10000; positions[pIdx+1] = 10000; positions[pIdx+2] = 10000;
        }
      }

      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;
      particleMaterial.size = (3 + audioData.rms * 10) * settings.brightCap;
      particleMaterial.opacity = Math.min(1.0, 0.5 + audioData.rms * 1.5) * settings.brightCap;
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.particleGeometry) (webGLAssets.particleGeometry as THREE.BufferGeometry).dispose();
        if (webGLAssets.particleMaterial) (webGLAssets.particleMaterial as THREE.PointsMaterial).dispose();
      }
    }
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/000000/E1CCFF.png?text=Tunnel&font=poppins', // SBNF Black bg, Lavender text
    dataAiHint: 'geometric tunnel flight tron',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
        camera.position.z = 0;

        const NUM_SEGMENTS = 25;
        const SEGMENT_DEPTH = 80;
        const tunnelSegments = [];

        const segmentGeometry = new THREE.TorusGeometry(100, 3, 8, 32); // Radius, tube, radialSegments, tubularSegments

        for (let i = 0; i < NUM_SEGMENTS; i++) {
            const material = new THREE.MeshBasicMaterial({ wireframe: true }); // Tron style
            const segment = new THREE.Mesh(segmentGeometry, material);
            segment.position.z = -i * SEGMENT_DEPTH;
            segment.rotation.x = Math.PI / 2; // Orient rings correctly
            scene.add(segment);
            tunnelSegments.push(segment);
        }

        return {
            scene, camera, tunnelSegments, NUM_SEGMENTS, SEGMENT_DEPTH,
            tempColor: new THREE.Color(),
            lastFrameTimeWebGL: performance.now(),
            cameraBaseFov: 75,
            cameraZSpeed: 50,
        } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { tunnelSegments, NUM_SEGMENTS, SEGMENT_DEPTH, tempColor, cameraBaseFov, cameraZSpeed } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        renderer.setClearColor(SBNF_HUES_SCENE.black, 1);

        // Move camera
        const speedBoost = 1 + audioData.rms * 2.5 + (audioData.beat ? 1.5 : 0);
        camera.position.z -= cameraZSpeed * speedBoost * deltaTime;

        const hueShift = (currentTime / 10000) * 360;

        tunnelSegments.forEach((segment: THREE.Mesh, i: number) => {
            // Recycle segments
            if (segment.position.z > camera.position.z + SEGMENT_DEPTH) { // A bit further to avoid pop-in
                segment.position.z -= NUM_SEGMENTS * SEGMENT_DEPTH;
            }

            // Audio-reactive color (Tron-like cyan/blue with SBNF orange/red pulses)
            let baseHue = SBNF_HUES_SCENE.tronBlue;
            let saturation = 80;
            let lightness = 40 + audioData.trebleEnergy * 30;

            if (audioData.beat && i % (Math.floor(1 + audioData.bassEnergy * 4)) === 0) { // Pulse some segments on beat
                baseHue = Math.random() < 0.6 ? SBNF_HUES_SCENE.orangeRed : SBNF_HUES_SCENE.orangeYellow;
                saturation = 95;
                lightness = 55 + audioData.bassEnergy * 20;
            }
            const finalHue = (baseHue + hueShift + i * 10) % 360;
            (segment.material as THREE.MeshBasicMaterial).color.setHSL(
                finalHue / 360,
                saturation / 100,
                Math.min(0.75, lightness / 100) * settings.brightCap
            );

            // Audio-reactive scale/rotation
            const scaleFactor = 1.0 + audioData.bassEnergy * 0.3 * Math.sin(currentTime * 0.002 + i * 0.5);
            segment.scale.set(scaleFactor, scaleFactor, scaleFactor);
            segment.rotation.z += (audioData.trebleEnergy * 0.025 + 0.001 + audioData.bpm * 0.00002) * (i % 2 === 0 ? 1.2 : -1.4) * deltaTime * 60; // Different rotation per segment
            segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0006 + i * 0.35) * audioData.midEnergy * 0.6; // Wobble
        });

        // Camera FOV effect for speed/warping
        camera.fov = cameraBaseFov - audioData.rms * 35 * settings.gamma + (audioData.beat ? 8 : 0) ; // Zoom in/out with RMS/beat
        camera.fov = Math.max(40, Math.min(110, camera.fov)); // Clamp FOV
        camera.updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets && webGLAssets.tunnelSegments) {
            webGLAssets.tunnelSegments.forEach((segment: THREE.Mesh) => {
                if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(segment);
                segment.geometry.dispose();
                (segment.material as THREE.Material).dispose();
            });
            webGLAssets.tunnelSegments = [];
        }
    }
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins', // SBNF Peach bg, Black text
    dataAiHint: 'strobe light flash',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(SBNF_HUES_SCENE.black), // SBNF Black
          transparent: false, // Strobe should be opaque
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(planeMesh);
      planeMesh.visible = false; // Start invisible

      return {
        scene, camera, planeMesh, planeMaterial, tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
        const { planeMesh, planeMaterial, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();

        renderer.setClearColor(bgColor!, 1); // Ensure background is SBNF black

        if (audioData.beat && audioData.rms > 0.05) {
            planeMesh.visible = true;
            // SBNF Strobe Colors: OrangeRed, OrangeYellow, LightPeach
            const strobeHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
            const hue = strobeHues[Math.floor(Math.random() * strobeHues.length)];
            const [r,g,b] = hslToRgb(hue, 95 + Math.random() * 5, 75 + Math.random() * 15); // Bright flash
            tempColor.setRGB(r,g,b);
            planeMaterial.color.copy(tempColor);
        } else {
            planeMesh.visible = false;
        }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.planeMesh) {
            if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(webGLAssets.planeMesh as THREE.Mesh);
            (webGLAssets.planeMesh as THREE.Mesh).geometry.dispose();
            ((webGLAssets.planeMesh as THREE.Mesh).material as THREE.Material).dispose();
        }
      }
    }
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Finale&font=poppins', // SBNF Purple bg, OrangeRed text
    dataAiHint: 'particle explosion confetti',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        camera.position.z = 400; // Start further back

        const PARTICLE_COUNT = 3000; // Reduced from 3500
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const colors = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);
        const lifetimes = new Float32Array(PARTICLE_COUNT); // Time remaining for each particle

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            lifetimes[i] = 0; // Initialize as "dead"
            const pIdx = i * 3;
            positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 10000; // Move off-screen
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 8 * settings.brightCap, // Base size modulated by brightCap
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        return {
            scene, camera, particles, particleMaterial: material, particleGeometry: geometry,
            positions, colors, velocities, lifetimes, PARTICLE_COUNT,
            tempColor: new THREE.Color(), lastBeatTime: 0,
            lastFrameTimeWebGL: performance.now(),
            cameraBaseFov: 75, // For FOV effects
            cameraBaseZ: 400,   // Base Z position for camera
            bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.01), // Very dark SBNF
        } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { particles, particleMaterial, particleGeometry, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor, bgColor, cameraBaseFov, cameraBaseZ } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (bgColor) renderer.setClearColor(bgColor, 0.08); // Slower fade for more trails

        // Camera zoom/movement based on RMS
        camera.fov = cameraBaseFov - audioData.rms * 20 * settings.gamma; // Less drastic FOV change
        camera.fov = Math.max(50, Math.min(90, camera.fov));
        camera.position.z = cameraBaseZ - audioData.rms * 150; // Less drastic Z change
        camera.updateProjectionMatrix();


        const beatCooldown = 150; // ms
        const particlesToSpawnOnBeat = Math.floor(PARTICLE_COUNT * 0.20); // Spawn up to 20% on beat
        let spawnedThisBeat = 0;

        if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            for (let i = 0; i < PARTICLE_COUNT && spawnedThisBeat < particlesToSpawnOnBeat; i++) {
                if (lifetimes[i] <= 0) { // Find a dead particle
                    const pIdx = i * 3;
                    // Spawn from center
                    positions[pIdx] = (Math.random() - 0.5) * 10;
                    positions[pIdx + 1] = (Math.random() - 0.5) * 10;
                    positions[pIdx + 2] = (Math.random() - 0.5) * 10;

                    // Velocity
                    const phi = Math.random() * Math.PI * 2;
                    const theta = Math.acos((Math.random() * 2) - 1);
                    const speed = 150 + (audioData.bassEnergy * 200) + (audioData.rms * 100) + Math.random() * 80;
                    velocities[pIdx] = speed * Math.sin(theta) * Math.cos(phi);
                    velocities[pIdx + 1] = speed * Math.sin(theta) * Math.sin(phi);
                    velocities[pIdx + 2] = speed * Math.cos(theta);

                    lifetimes[i] = 2.0 + Math.random() * 2.5; // Lifetime

                    // SBNF Burst Colors: OrangeRed, OrangeYellow, LightLavender
                    const burstHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
                    const hue = burstHues[Math.floor(Math.random() * burstHues.length)];
                    const baseLightness = 45 + Math.random() * 20; // Range 45-65
                    const lightnessVariation = (audioData.beat ? 10 : 0) + (audioData.rms * 15);
                    const finalLightness = Math.min(70, baseLightness + lightnessVariation); // Capped lightness to reduce whiteness
                    const [r,g,b] = hslToRgb(hue, 90 + Math.random() * 10, finalLightness);
                    colors[pIdx] = r; colors[pIdx + 1] = g; colors[pIdx + 2] = b;

                    spawnedThisBeat++;
                }
            }
        }

        const dragFactor = 0.96; // Slightly stronger drag
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (lifetimes[i] > 0) {
                const pIdx = i * 3;
                positions[pIdx] += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

                velocities[pIdx] *= dragFactor;
                velocities[pIdx + 1] *= dragFactor;
                velocities[pIdx + 2] *= dragFactor;

                lifetimes[i] -= deltaTime;
                const lifeRatio = Math.max(0, lifetimes[i] / (webGLAssets.particleInitialLifetimes?.[i] || 2.5));
                 webGLAssets.particleInitialLifetimes = webGLAssets.particleInitialLifetimes || new Float32Array(PARTICLE_COUNT);
                 if(!webGLAssets.particleInitialLifetimes[i] && lifetimes[i] > 0) webGLAssets.particleInitialLifetimes[i] = lifetimes[i] + deltaTime;


                // Fade color by darkening (multiplying by lifeRatio)
                const fadeFactor = Math.pow(lifeRatio, 0.5); // sqrt easing for fade
                colors[pIdx] *= fadeFactor;
                colors[pIdx + 1] *= fadeFactor;
                colors[pIdx + 2] *= fadeFactor;


                if (lifetimes[i] <= 0) { // Particle is dead
                    positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 10000; // Move off-screen
                }
            }
        }

        particleGeometry.attributes.position.needsUpdate = true;
        particleGeometry.attributes.color.needsUpdate = true;
        particleMaterial.size = (5 + audioData.rms * 15) * settings.brightCap; // Adjusted size reactivity
        particleMaterial.opacity = Math.min(0.85, 0.4 + audioData.rms * 1.2) * settings.brightCap; // Adjusted opacity

        // Gentle rotation of the whole particle system
        particles.rotation.x += audioData.midEnergy * 0.0005;
        particles.rotation.y += audioData.trebleEnergy * 0.0007;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.particleGeometry) (webGLAssets.particleGeometry as THREE.BufferGeometry).dispose();
            if (webGLAssets.particleMaterial) (webGLAssets.particleMaterial as THREE.PointsMaterial).dispose();
            if (webGLAssets.particles && webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(webGLAssets.particles as THREE.Points);
        }
    }
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";
