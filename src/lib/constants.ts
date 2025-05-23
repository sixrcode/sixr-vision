
import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets, ProceduralVine } from '@/types';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

export const FFT_SIZES = [128, 256, 512] as const;

// SBNF Palette HSL (from the branding guide)
const SBNF_HUES_SCENE = {
  black: 0, // #000000
  orangeRed: 13, // #FF441A (Primary)
  orangeYellow: 36, // #FDB143 (Accent)
  lightPeach: 30, // #FFECDA (Foreground)
  lightLavender: 267, // #E1CCFF (Accent 2)
  deepPurple: 258, // #5A36BB (Background)
  // For Tron-like effects or cool accents
  tronBlue: 197, // A bright cyan/blue
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
  showWebcam: true,
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins',
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const webGLAssets: Partial<WebGLSceneAssets> & {
        lastCanvasWidth?: number,
        lastCanvasHeight?: number,
        GRAPE_COUNT?: number,
        lastGrapeSpawnTime?: number,
        noiseTexture?: THREE.DataTexture,
        vinesData?: { activeVines: ProceduralVine[], nextVineId: number, lastSpawnTime: number, spawnCooldown: number, maxVines: number },
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
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.08), // Darker purple for background
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
          uniform vec3 u_rimColor; // For Fresnel-like rim
          uniform vec3 u_fillColor1; // Primary fill for silhouette (e.g., SBNF Deep Purple)
          uniform vec3 u_fillColor2; // Secondary fill color for variation (e.g., SBNF Lavender)
          uniform float u_opacityFactor;
          uniform float u_time; // For scrolling noise
          varying vec2 vUv;

          // Simplified Fresnel approximation for a full-screen quad/plane
          float fresnelApprox(vec2 uv_coords, float power) {
            float edgeFactorX = pow(1.0 - 2.0 * abs(uv_coords.x - 0.5), power);
            float edgeFactorY = pow(1.0 - 2.0 * abs(uv_coords.y - 0.5), power);
            return clamp(edgeFactorX + edgeFactorY, 0.0, 1.0);
          }

          void main() {
            // Shader throttling: Discard half the pixels for performance
            if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard;

            vec4 webcamColor = texture2D(u_webcamTexture, vUv);
            // Use luma for silhouette masking. Adjust thresholds for desired effect.
            float luma = dot(webcamColor.rgb, vec3(0.299, 0.587, 0.114));
            float silhouetteMask = smoothstep(0.25, 0.55, luma); // Softer edge

            // Scrolling noise texture for nebula fill
            vec2 noiseUv = vUv * 2.5 + vec2(u_time * 0.04, u_time * 0.025); // Slower scroll
            vec3 noiseVal = texture2D(u_noiseTexture, noiseUv).rgb;
            vec3 dynamicFill = mix(u_fillColor1, u_fillColor2, noiseVal.r); // Mix fill colors based on noise

            // Fresnel-like rim lighting
            float rim = fresnelApprox(vUv, 3.0); // Fresnel effect, power 3
            vec3 finalColor = mix(dynamicFill, u_rimColor, rim * 0.85); // Blend fill with rim color

            // Combine silhouette mask with opacity factor and webcam alpha
            float finalAlpha = silhouetteMask * u_opacityFactor * webcamColor.a;
            // Compensate for discarding pixels by slightly increasing alpha, capped at 1.0
            gl_FragColor = vec4(finalColor, clamp(finalAlpha * 1.85, 0.0, 1.0));
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
        const grapeCurrentSizes = new Float32Array(GRAPE_COUNT); // For shader if needed, or CPU size
        const grapeTargetSizes = new Float32Array(GRAPE_COUNT); // Target size for animation
        const grapeLifetimes = new Float32Array(GRAPE_COUNT);
        const grapeSpawnTimes = new Float32Array(GRAPE_COUNT);
        for (let i = 0; i < GRAPE_COUNT; i++) grapeLifetimes[i] = 0; // Start dead

        const grapeGeometry = new THREE.BufferGeometry();
        grapeGeometry.setAttribute('position', new THREE.BufferAttribute(grapePositions, 3));
        grapeGeometry.setAttribute('color', new THREE.BufferAttribute(grapeColors, 3));
        grapeGeometry.setAttribute('size', new THREE.BufferAttribute(grapeCurrentSizes, 1)); // For PointsMaterial size

        const grapeMaterial = new THREE.PointsMaterial({
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true, // Make size screen-space dependent
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
        webGLAssets.planeMesh = undefined;
        webGLAssets.videoTexture = undefined;
        webGLAssets.shaderMaterial = undefined;
      }
      return webGLAssets as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      const { planeMesh, shaderMaterial, videoTexture, noiseTexture, bgColor,
              grapes, grapeGeometry, grapeMaterial, grapePositions, grapeColors, grapeTargetSizes,
              grapeCurrentSizes, grapeLifetimes, grapeSpawnTimes, GRAPE_COUNT, tempColor, vinesData
      } = webGLAssets as any; // Cast to any to access dynamic properties

      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime - 16)) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (bgColor) {
        renderer.setClearColor(bgColor, 1); // Use the scene's specific background color
        renderer.clear();
      }


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
        if (videoTexture.image !== webcamElement) videoTexture.image = webcamElement; // Ensure texture is up-to-date
        videoTexture.needsUpdate = true;

        shaderMaterial.uniforms.u_time.value = currentTime * 0.001; // For noise scrolling
        shaderMaterial.uniforms.u_mirrorX.value = settings.mirrorWebcam;
        const baseOpacity = settings.brightCap * (0.7 + audioData.rms * 0.5);
        shaderMaterial.uniforms.u_opacityFactor.value = Math.min(1.0, baseOpacity);

        const hueTimeShift = (currentTime / 15000) * 360;
        shaderMaterial.uniforms.u_rimColor.value.setHSL(
          ((SBNF_HUES_SCENE.orangeYellow + audioData.trebleEnergy * 60 + hueTimeShift) % 360) / 360,
          0.98,
          0.65 + audioData.beat * 0.1
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
        const beatCooldown = 150; // ms, for grape spawning
        let spawnedThisFrameGrapes = 0;
        const maxSpawnPerBeatGrapes = Math.floor(GRAPE_COUNT * 0.15); // Spawn up to 15% of total grapes on a beat

        if (audioData.beat && (currentTime - (webGLAssets.lastGrapeSpawnTime || 0) > beatCooldown)) {
            webGLAssets.lastGrapeSpawnTime = currentTime;
            let grapesToSpawnCount = Math.floor(GRAPE_COUNT * (0.05 + audioData.bassEnergy * 0.2));
            grapesToSpawnCount = Math.min(grapesToSpawnCount, maxSpawnPerBeatGrapes); // Cap per beat

            for (let i = 0; i < GRAPE_COUNT && spawnedThisFrameGrapes < grapesToSpawnCount; i++) {
                if (grapeLifetimes[i] <= 0) { // Find a "dead" particle
                    const pIdx = i * 3;
                    // Spawn near center or based on silhouette edges if available
                    grapePositions[pIdx] = (Math.random() - 0.5) * canvasWidth * 0.6; // Spread them a bit
                    grapePositions[pIdx + 1] = (Math.random() - 0.5) * canvasHeight * 0.6;
                    grapePositions[pIdx + 2] = (Math.random() - 0.5) * 30; // Slight depth variation

                    grapeLifetimes[i] = 1.5 + Math.random() * 1.5; // Lifetime in seconds
                    grapeSpawnTimes[i] = currentTime; // Record spawn time in ms

                    // Color: Start Lavender, ripen to Orange-Red
                    const initialColorHue = SBNF_HUES_SCENE.lightLavender;
                    const [r,g,b] = hslToRgb(initialColorHue, 80 + Math.random()*20, 60 + Math.random()*10);
                    tempColor.setRGB(r,g,b);
                    grapeColors[pIdx] = tempColor.r;
                    grapeColors[pIdx + 1] = tempColor.g;
                    grapeColors[pIdx + 2] = tempColor.b;

                    grapeTargetSizes[i] = (15 + audioData.bassEnergy * 40 + Math.random() * 10) * Math.max(0.5, settings.brightCap);
                    grapeCurrentSizes[i] = 0.1; // Start very small for "pop" animation
                    spawnedThisFrameGrapes++;
                }
            }
        }

        for (let i = 0; i < GRAPE_COUNT; i++) {
            if (grapeLifetimes[i] > 0) {
                const pIdx = i * 3;
                grapeLifetimes[i] -= deltaTime;

                const ageMs = currentTime - grapeSpawnTimes[i];
                const initialLifetimeMs = (webGLAssets.grapeInitialLifetimes?.[i] || (1.5 + Math.random() * 1.5)) * 1000; // Use stored or approximate
                const lifeRatio = Math.max(0, Math.min(1, ageMs / (initialLifetimeMs + 0.01) ));

                // Color ripening: Lavender -> Orange-Red
                const startHue = SBNF_HUES_SCENE.lightLavender;
                const endHue = SBNF_HUES_SCENE.orangeRed;
                const currentHue = startHue + (endHue - startHue) * lifeRatio;
                const currentSaturation = 90 + (100 - 90) * lifeRatio; // Increase saturation as it ripens
                const currentLightness = 65 + (55 - 65) * lifeRatio; // Slightly darken as it ripens/fades
                const [r,g,b] = hslToRgb(currentHue, currentSaturation, currentLightness);
                tempColor.setRGB(r,g,b);
                grapeColors[pIdx] = tempColor.r;
                grapeColors[pIdx + 1] = tempColor.g;
                grapeColors[pIdx + 2] = tempColor.b;

                // Size "pop" animation
                const popDurationMs = 300; // Duration of the pop animation
                if (ageMs < popDurationMs) {
                    grapeCurrentSizes[i] = Math.min(grapeTargetSizes[i], (ageMs / popDurationMs) * grapeTargetSizes[i]);
                } else {
                    // After pop, hold size or fade based on remaining life
                    const remainingLifetimeRatio = Math.max(0, grapeLifetimes[i] / ((initialLifetimeMs / 1000) - (popDurationMs / 1000) + 0.01));
                    grapeCurrentSizes[i] = grapeTargetSizes[i] * Math.pow(remainingLifetimeRatio, 2); // Fade size
                }
                grapeCurrentSizes[i] = Math.max(0.1, grapeCurrentSizes[i]); // Min size before disappearing

                if (grapeLifetimes[i] <= 0) {
                    grapeCurrentSizes[i] = 0; // Mark as dead by making invisible
                }
            } else {
                 grapeCurrentSizes[i] = 0; // Ensure dead particles are invisible
            }
        }
        if (grapeGeometry && grapeGeometry.attributes) {
          if(grapeGeometry.attributes.position) (grapeGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          if(grapeGeometry.attributes.color) (grapeGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
          if(grapeGeometry.attributes.size) (grapeGeometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
        }
        if(grapeMaterial) {
            grapeMaterial.needsUpdate = true; // Important for PointsMaterial custom attributes
            grapeMaterial.size = settings.brightCap * 2.5; // Global size multiplier
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
            // More organic curl: combine a base curl with noise and directional tendency
            const baseCurl = Math.sin(currentTime * 0.0005 * vine.curlFactor + vine.id + vine.points.length * 0.1) * Math.PI * curlInfluence;
            const randomWiggle = (Math.random() - 0.5) * 0.1 * (1 + audioData.trebleEnergy); // Add a bit of random jitter
            vine.angle += baseCurl * (deltaTime * 50) + randomWiggle;

            const segmentLength = vine.speed * 1.5 * (1 + audioData.rms * 0.5);
            let nextX = lastPoint.x + Math.cos(vine.angle) * segmentLength;
            let nextY = lastPoint.y + Math.sin(vine.angle) * segmentLength;

            // Simple boundary reflection
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
        if (webGLAssets.vinesData) (webGLAssets.vinesData as any).activeVines = []; // Clear the array
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

      // Pre-create geometries
      const circleGeometry = new THREE.CircleGeometry(50, 32); // Radius 50
      const squareGeometry = new THREE.PlaneGeometry(100, 100); // Width 100, Height 100
      const triangleShape = new THREE.Shape();
      triangleShape.moveTo(-50, -43.3); triangleShape.lineTo(50, -43.3);
      triangleShape.lineTo(0, 43.3); triangleShape.lineTo(-50, -43.3);
      const triangleGeometry = new THREE.ShapeGeometry(triangleShape);

      return {
        scene, camera,
        geometries: [circleGeometry, squareGeometry, triangleGeometry],
        activeShapes: [], // Will hold { mesh: THREE.Mesh, lifetime: number, initialScale: number, rotationSpeed: number }
        spawnCooldown: 100, // ms
        lastSpawnTime: 0,
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.05), // Very dark, almost black
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { geometries, activeShapes, spawnCooldown, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime - 16)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (bgColor) renderer.setClearColor(bgColor, 0.15); // Slow fade for trails

        // Spawn new shapes
        const shouldSpawn = (audioData.beat && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown / 2)) ||
                            (audioData.rms > 0.15 && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown));

        if (shouldSpawn && activeShapes.length < 50) { // Cap active shapes
            webGLAssets.lastSpawnTime = currentTime;
            const geometry = geometries[Math.floor(Math.random() * geometries.length)];
            const material = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0.0, // Start fully transparent, fade in
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
                lifetime: 2.0 + Math.random() * 2.0, // seconds
                initialScale,
                maxScale: initialScale * (1.5 + audioData.rms * 2.0),
                currentOpacity: 0,
                targetOpacity: Math.min(1.0, 0.3 + audioData.rms * 0.7) * settings.brightCap,
                rotationSpeed: (Math.random() - 0.5) * 0.5 * (1 + audioData.bpm / 120),
                spawnTime: currentTime,
            });
            scene.add(mesh);
        }

        // Update active shapes
        for (let i = activeShapes.length - 1; i >= 0; i--) {
            const shape = activeShapes[i];
            shape.lifetime -= deltaTime;

            if (shape.lifetime <= 0) {
                scene.remove(shape.mesh);
                shape.mesh.geometry.dispose();
                shape.mesh.material.dispose();
                activeShapes.splice(i, 1);
                continue;
            }

            const lifeRatio = 1.0 - (shape.lifetime / (2.0 + Math.random() * 2.0)); // Approx

            // Fade in, then fade out
            const fadeInDuration = 0.3; // seconds
            const fadeOutStartTime = (2.0 + Math.random() * 2.0) - 0.5; // Start fading out in the last 0.5s

            if ((currentTime - shape.spawnTime)/1000 < fadeInDuration) {
                 shape.currentOpacity = Math.min(shape.targetOpacity, shape.targetOpacity * (((currentTime - shape.spawnTime)/1000) / fadeInDuration) );
            } else if (shape.lifetime < 0.5) { // Fade out
                shape.currentOpacity = shape.targetOpacity * (shape.lifetime / 0.5);
            } else {
                shape.currentOpacity = shape.targetOpacity; // Hold opacity
            }
            shape.mesh.material.opacity = Math.max(0, shape.currentOpacity);


            const scaleProgress = Math.min(1, lifeRatio * 2); // Scale up quickly then hold
            const currentScale = shape.initialScale + (shape.maxScale - shape.initialScale) * Math.sin(scaleProgress * Math.PI * 0.5); // EaseOutQuad like
            shape.mesh.scale.set(currentScale, currentScale, currentScale);
            shape.mesh.rotation.z += shape.rotationSpeed * deltaTime;
        }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        webGLAssets.activeShapes?.forEach((shape: any) => {
            if (shape.mesh) {
                if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(shape.mesh);
                if(shape.mesh.geometry) shape.mesh.geometry.dispose();
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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings&font=poppins&bgcolor=SBNF_Black&textcolor=SBNF_Orange_Yellow',
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const ringGeometry = new THREE.RingGeometry(1, 1.1, 64, 1, 0, Math.PI * 2); // InnerR, OuterR, ThetaSeg, PhiSeg, ThetaStart, ThetaLength

      return {
        scene, camera,
        ringGeometry,
        activeBassRings: [], // { mesh, lifetime, initialScale }
        activeMidRings: [],
        activeTrebleRings: [],
        spawnCooldown: 50, //ms
        lastSpawnTimes: [0,0,0], // Bass, Mid, Treble
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.03), // Very dark
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { ringGeometry, activeBassRings, activeMidRings, activeTrebleRings, spawnCooldown, lastSpawnTimes, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime - 16)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (bgColor) renderer.setClearColor(bgColor, 0.2); // Slow fade for trails

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
                    opacity: 0, // Start transparent
                    side: THREE.DoubleSide,
                });
                const [r,g,b] = hslToRgb( (band.colorHue + (Math.random() * 30 - 15) + (currentTime/200)) % 360, 90 + band.energy * 10, 50 + band.energy * 25 );
                material.color.setRGB(r,g,b);

                const mesh = new THREE.Mesh(ringGeometry, material);
                mesh.scale.set(0.1, 0.1, 1); // Start small
                const ringData = {
                    mesh,
                    lifetime: 1.0 + band.energy * 1.5, // seconds
                    initialScale: 0.1,
                    maxScale: (canvasWidth * 0.45) * (0.5 + band.energy * 0.8),
                    targetOpacity: Math.min(0.8, 0.3 + band.energy * 0.7) * settings.brightCap,
                    currentOpacity: 0,
                    spawnTime: currentTime,
                };
                band.rings.push(ringData);
                scene.add(mesh);
            }

            // Update active rings for this band
            for (let i = band.rings.length - 1; i >= 0; i--) {
                const ring = band.rings[i];
                ring.lifetime -= deltaTime;

                if (ring.lifetime <= 0) {
                    scene.remove(ring.mesh);
                    ring.mesh.material.dispose(); // Ring geometry is shared, not disposed per ring
                    band.rings.splice(i, 1);
                    continue;
                }
                const lifeRatio = 1.0 - (ring.lifetime / (1.0 + band.energy * 1.5));

                 // Fade in, then fade out
                const fadeInDuration = 0.2; // seconds
                if ((currentTime - ring.spawnTime)/1000 < fadeInDuration) {
                    ring.currentOpacity = Math.min(ring.targetOpacity, ring.targetOpacity * (((currentTime - ring.spawnTime)/1000) / fadeInDuration) );
                } else if (ring.lifetime < 0.3) { // Fade out in last 0.3s
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
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins&bgcolor=SBNF_Light_Lavender&textcolor=SBNF_Deep_Purple',
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const GRID_SIZE_X = 20; // Number of cells horizontally
      const GRID_SIZE_Y = 12; // Number of cells vertically
      const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

      const cellGeometry = new THREE.PlaneGeometry(1, 1); // Base geometry for a cell
      const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, totalCells);
      scene.add(instancedMesh);

      const cellStates = []; // To store individual cell animation states
      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();

      const cellBaseWidth = canvas.width / GRID_SIZE_X;
      const cellBaseHeight = canvas.height / GRID_SIZE_Y;

      for (let i = 0; i < totalCells; i++) {
        const x = i % GRID_SIZE_X;
        const y = Math.floor(i / GRID_SIZE_X);

        dummy.position.set(
            (x - GRID_SIZE_X / 2 + 0.5) * cellBaseWidth,
            (y - GRID_SIZE_Y / 2 + 0.5) * cellBaseHeight,
            0
        );
        dummy.scale.set(cellBaseWidth * 0.85, cellBaseHeight * 0.85, 1); // Add spacing
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, tempColor.setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.6, 0.1)); // Initial dim color
        cellStates.push({
            targetHue: SBNF_HUES_SCENE.deepPurple,
            targetLightness: 0.1,
            currentLightness: 0.1,
            lastPulseTime: 0,
        });
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.instanceColor!.needsUpdate = true;


      return {
        scene, camera, instancedMesh, cellStates, GRID_SIZE_X, GRID_SIZE_Y, totalCells,
        cellBaseWidth, cellBaseHeight, tempColor,
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.02), // Very dark background
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { instancedMesh, cellStates, GRID_SIZE_X, GRID_SIZE_Y, totalCells, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime-16)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if(bgColor) renderer.setClearColor(bgColor, 0.1); // Slight trail effect

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;

        for (let i = 0; i < totalCells; i++) {
            const state = cellStates[i];
            const spectrumIndex = Math.floor((i / totalCells) * spectrumLength);
            const energy = (spectrum[spectrumIndex] || 0) / 255;

            if (energy > 0.2 && currentTime - state.lastPulseTime > 100) { // Pulse on energy spike
                state.lastPulseTime = currentTime;
                state.targetHue = (SBNF_HUES_SCENE.orangeRed + energy * 90 + (i * 5) + (currentTime/500)) % 360;
                state.targetLightness = 0.3 + energy * 0.4 * settings.brightCap;
            } else {
                state.targetLightness *= 0.97; // Decay lightness if no pulse
                state.targetLightness = Math.max(0.05, state.targetLightness); // Minimum dimness
            }
            state.currentLightness += (state.targetLightness - state.currentLightness) * 0.1; // Smooth transition

            const [r,g,b] = hslToRgb(state.targetHue, 0.8 + energy * 0.2, state.currentLightness * 100);
            tempColor.setRGB(r,g,b);
            instancedMesh.setColorAt(i, tempColor);
        }
        instancedMesh.instanceColor.needsUpdate = true;
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins&bgcolor=SBNF_Deep_Purple&textcolor=SBNF_Orange_Yellow',
    dataAiHint: 'audio spectrum analysis',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const numBars = Math.floor((settings.fftSize / 2)); // One bar per spectrum bin
      const barBaseWidth = canvas.width / (numBars * 1.5); // Spacing between bars

      const barGeometry = new THREE.PlaneGeometry(1, 1); // Base geometry for a bar
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      scene.add(instancedMesh);

      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();

      // Initial setup of matrices (positions don't change, only scale and color)
      for (let i = 0; i < numBars; i++) {
        const xPosition = (i - numBars / 2 + 0.5) * barBaseWidth * 1.5;
        dummy.position.set(xPosition, -canvas.height / 2, 0); // Position at bottom edge
        dummy.scale.set(barBaseWidth, 1, 1); // Initial height 1, width set
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, tempColor.setHSL(SBNF_HUES_SCENE.deepPurple/360, 0.6, 0.1));
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.instanceColor!.needsUpdate = true;

      return {
        scene, camera, instancedMesh, numBars, barBaseWidth, dummy, tempColor,
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.01), // Very dark background
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { instancedMesh, numBars, barBaseWidth, dummy, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if(bgColor) renderer.setClearColor(bgColor, 1); // Solid background

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length; // Should match numBars

        for (let i = 0; i < numBars; i++) {
            if (i >= spectrumLength) continue; // Safety check

            const value = spectrum[i] / 255; // Normalize to 0-1
            const barHeight = Math.max(1, value * canvas.height * 0.8 * settings.brightCap * (1 + audioData.rms * 0.5));

            // Update scale (height) and Y position for each bar
            // Bars grow upwards from the bottom edge.
            const yPosition = -canvas.height / 2 + barHeight / 2;
            const xPosition = (i - numBars / 2 + 0.5) * barBaseWidth * 1.5; // Keep X position fixed

            dummy.position.set(xPosition, yPosition, 0);
            dummy.scale.set(barBaseWidth, barHeight, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            // Color based on SBNF palette and audio energy
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
    id: 'strobe_light',
    name: 'Strobe Light',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins&bgcolor=SBNF_Light_Peach&textcolor=SBNF_Black',
    dataAiHint: 'strobe light flash',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      // Orthographic camera for full-screen quad
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const planeGeometry = new THREE.PlaneGeometry(2, 2); // Covers the entire screen
      const planeMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(SBNF_HUES_SCENE.black), // Start with black
          transparent: true,
          opacity: 1.0, // Will be set to 0 for "off" state
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(planeMesh);

      return {
        scene, camera, planeMesh, planeMaterial, tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // Not really used as plane covers screen
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
        const { planeMesh, planeMaterial, tempColor } = webGLAssets as any;
        const currentTime = performance.now();

        if (audioData.beat && audioData.rms > 0.1) { // Flash on beat if RMS is also decent
            planeMesh.visible = true;
            const hue = (SBNF_HUES_SCENE.lightPeach + (currentTime / 100)) % 360; // Cycle through light SBNF colors
            const [r,g,b] = hslToRgb(hue, 100, 80 + Math.random() * 15); // Bright flash
            tempColor.setRGB(r,g,b);
            planeMaterial.color.copy(tempColor);
            planeMaterial.opacity = settings.brightCap * 0.85; // Controlled by brightCap
        } else {
            planeMesh.visible = false; // Turn off the flash (background will show)
            // Or, to ensure black screen when "off":
            // planeMaterial.color.set(SBNF_HUES_SCENE.black);
            // planeMaterial.opacity = 1.0;
            // planeMesh.visible = true;
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
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";
