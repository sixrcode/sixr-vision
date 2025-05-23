
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
  logoOpacity: 0.25, // Slightly more prominent SBNF branding
  showWebcam: true, // Enable webcam by default for SBNF
  mirrorWebcam: true,
  currentSceneId: 'radial_burst', // SBNF Default starting scene
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse', // SBNF Default
    speed: 1,
    color: '#FF441A', // SBNF Orange-Red for solid/blink
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500,
  sceneTransitionActive: true,
  monitorAudio: false,
  selectedAudioInputDeviceId: undefined,
  enableAiOverlay: false, // Initial auto-gen handled in AiVisualOverlayMixer
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent", // SBNF Themed
  enablePeriodicAiOverlay: false, // User-controlled periodic updates
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins', // SBNF Purple bg, Peach text
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const webGLAssets: Partial<WebGLSceneAssets> & {
        lastCanvasWidth?: number,
        lastCanvasHeight?: number,
        noiseTexture?: THREE.DataTexture,
        vinesData?: { activeVines: ProceduralVine[], nextVineId: number, lastSpawnTime: number, spawnCooldown: number, maxVines: number },
        GRAPE_COUNT?: number;
        lastGrapeSpawnTime?: number;
        grapeInitialLifetimes?: Float32Array; // Re-added
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
        videoTexture.minFilter = THREE.NearestFilter;
        videoTexture.magFilter = THREE.NearestFilter;
        videoTexture.generateMipmaps = false;
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        webGLAssets.videoTexture = videoTexture;

        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height); // Will be updated in drawWebGL
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

          // Simple Fresnel approximation for planes viewed head-on
          float fresnelApprox(vec2 uv_coords, float power) {
            float edgeFactorX = pow(1.0 - 2.0 * abs(uv_coords.x - 0.5), power);
            float edgeFactorY = pow(1.0 - 2.0 * abs(uv_coords.y - 0.5), power);
            return clamp(edgeFactorX + edgeFactorY, 0.0, 1.0);
          }

          void main() {
            // Checkerboard discard for performance
            if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard;

            vec4 webcamColor = texture2D(u_webcamTexture, vUv);
            // Use luma as a simple silhouette key, adjust thresholds for crispness
            float luma = dot(webcamColor.rgb, vec3(0.299, 0.587, 0.114));
            float silhouetteMask = smoothstep(0.25, 0.55, luma); // Adjust these for silhouette definition

            // Scrolling noise for fill
            vec2 noiseUv = vUv * 2.5 + vec2(u_time * 0.04, u_time * 0.025); // Adjust multipliers for noise scale/speed
            vec3 noiseVal = texture2D(u_noiseTexture, noiseUv).rgb;
            vec3 dynamicFill = mix(u_fillColor1, u_fillColor2, noiseVal.r); // Mix between two fill colors based on noise

            // Fresnel for rim lighting
            float rim = fresnelApprox(vUv, 3.0); // Power of 3 for a moderate rim
            vec3 finalColor = mix(dynamicFill, u_rimColor, rim * 0.85); // Mix fill with rim color

            // Alpha blending
            float alphaCompensation = 1.85; // To compensate for discarded fragments
            float finalAlpha = silhouetteMask * u_opacityFactor * webcamColor.a * alphaCompensation;

            gl_FragColor = vec4(finalColor, clamp(finalAlpha, 0.0, 1.0));
          }
        `;
        const shaderMaterial = new THREE.ShaderMaterial({
          vertexShader, fragmentShader,
          uniforms: {
            u_webcamTexture: { value: videoTexture },
            u_noiseTexture: { value: webGLAssets.noiseTexture },
            u_rimColor: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeYellow / 360, 0.98, 0.63) }, // SBNF Orange-Yellow
            u_fillColor1: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.47) }, // SBNF Deep Purple
            u_fillColor2: { value: new THREE.Color().setHSL(SBNF_HUES_SCENE.lightLavender / 360, 1.0, 0.90) }, // SBNF Light Lavender
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
        const grapeCurrentSizes = new Float32Array(GRAPE_COUNT); // For shader-based size or PointsMaterial
        const grapeTargetSizes = new Float32Array(GRAPE_COUNT); // For animation target
        const grapeLifetimes = new Float32Array(GRAPE_COUNT);
        const grapeSpawnTimes = new Float32Array(GRAPE_COUNT);
        const grapeInitialLifetimes = new Float32Array(GRAPE_COUNT); // Store initial lifetime for smooth fades

        for (let i = 0; i < GRAPE_COUNT; i++) grapeLifetimes[i] = 0; // Start all dead

        const grapeGeometry = new THREE.BufferGeometry();
        grapeGeometry.setAttribute('position', new THREE.BufferAttribute(grapePositions, 3));
        grapeGeometry.setAttribute('color', new THREE.BufferAttribute(grapeColors, 3));
        grapeGeometry.setAttribute('size', new THREE.BufferAttribute(grapeCurrentSizes, 1)); // Custom attribute for shader

        const grapeMaterial = new THREE.PointsMaterial({
            vertexColors: true,
            size: settings.brightCap * 2.5, // Base size, can be overridden by 'size' attribute if shader handles it
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
        if (webGLAssets.bgColor) scene.background = webGLAssets.bgColor;
      }
      return webGLAssets as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      const { planeMesh, shaderMaterial, videoTexture, bgColor,
              grapes, grapeGeometry, grapeMaterial, grapePositions, grapeColors, grapeTargetSizes,
              grapeCurrentSizes, grapeLifetimes, grapeSpawnTimes, GRAPE_COUNT, tempColor,
              grapeInitialLifetimes, vinesData // vinesData for drawing procedural vines
      } = webGLAssets as any; // Cast to any to access dynamic properties

      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (bgColor && (!settings.showWebcam || !videoTexture || !planeMesh)) {
        renderer.setClearColor(bgColor, 1);
      } else if (settings.showWebcam && videoTexture && planeMesh) {
         // Rely on plane mesh to cover screen, or set clear color if plane is smaller
        if (planeMesh.geometry.parameters.width < canvasWidth || planeMesh.geometry.parameters.height < canvasHeight) {
           renderer.setClearColor(bgColor || 0x000000, 1);
        } else {
           renderer.setClearColor(0x000000, 0); // If plane is full screen, clear to transparent
        }
      } else {
        renderer.setClearColor(0x000000, 0); // Default clear if nothing else applies
      }


      if (planeMesh && shaderMaterial && videoTexture && settings.showWebcam && webcamElement?.readyState >= webcamElement.HAVE_ENOUGH_DATA) {
        if (webGLAssets.lastCanvasWidth !== canvasWidth || webGLAssets.lastCanvasHeight !== canvasHeight) {
            if (planeMesh.geometry) planeMesh.geometry.dispose();
            planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
            if (camera instanceof THREE.OrthographicCamera) {
              camera.left = -canvasWidth / 2; camera.right = canvasWidth / 2;
              camera.top = canvasHeight / 2; camera.bottom = -canvasHeight / 2;
              camera.updateProjectionMatrix();
            }
            shaderMaterial.uniforms.u_resolution.value.set(canvasWidth, canvasHeight);
            webGLAssets.lastCanvasWidth = canvasWidth;
            webGLAssets.lastCanvasHeight = canvasHeight;
        }
        if (videoTexture.image !== webcamElement) videoTexture.image = webcamElement; // Ensure texture uses current element
        videoTexture.needsUpdate = true;

        shaderMaterial.uniforms.u_time.value = currentTime * 0.001;
        shaderMaterial.uniforms.u_mirrorX.value = settings.mirrorWebcam;
        const baseOpacity = settings.brightCap * (0.7 + audioData.rms * 0.5);
        shaderMaterial.uniforms.u_opacityFactor.value = Math.min(1.0, baseOpacity);

        const hueTimeShift = (currentTime / 15000) * 360; // Slow hue cycle
        shaderMaterial.uniforms.u_rimColor.value.setHSL(
          ((SBNF_HUES_SCENE.orangeYellow + audioData.trebleEnergy * 60 + hueTimeShift) % 360) / 360,
          0.98, // Saturation
          0.65 + (audioData.beat ? 0.1 : 0) // Lightness, brighter on beat
        );
        shaderMaterial.uniforms.u_fillColor1.value.setHSL(
          ((SBNF_HUES_SCENE.deepPurple + audioData.bassEnergy * 40 + hueTimeShift * 0.8) % 360) / 360,
          0.6, // Saturation
          0.3 + audioData.midEnergy * 0.25 // Lightness
        );
        shaderMaterial.uniforms.u_fillColor2.value.setHSL(
          ((SBNF_HUES_SCENE.lightLavender + audioData.midEnergy * 50 + hueTimeShift * 1.2) % 360) / 360,
          0.9, // Saturation
          0.5 + audioData.trebleEnergy * 0.3 // Lightness
        );
        planeMesh.visible = true;
      } else {
        if (planeMesh) planeMesh.visible = false;
      }

      // Grape particle logic
      if (grapes && grapeLifetimes && grapePositions && grapeColors && grapeCurrentSizes && grapeTargetSizes && grapeSpawnTimes && tempColor && GRAPE_COUNT && grapeMaterial && grapeInitialLifetimes) {
        const beatCooldown = 150; // ms between beat-triggered spawns
        let spawnedThisFrameGrapes = 0;
        const maxSpawnPerBeatGrapes = Math.floor(GRAPE_COUNT * 0.15); // e.g., 15% of total grapes

        if (audioData.beat && (currentTime - (webGLAssets.lastGrapeSpawnTime || 0) > beatCooldown)) {
            webGLAssets.lastGrapeSpawnTime = currentTime;
            let grapesToSpawnCount = Math.floor(GRAPE_COUNT * (0.05 + audioData.bassEnergy * 0.2)); // Spawn more with higher bass
            grapesToSpawnCount = Math.min(grapesToSpawnCount, maxSpawnPerBeatGrapes);

            for (let i = 0; i < GRAPE_COUNT && spawnedThisFrameGrapes < grapesToSpawnCount; i++) {
                if (grapeLifetimes[i] <= 0) { // Find a "dead" particle to reuse
                    const pIdx = i * 3;
                    // Spawn near center for orthographic view
                    grapePositions[pIdx] = (Math.random() - 0.5) * canvasWidth * 0.6;
                    grapePositions[pIdx + 1] = (Math.random() - 0.5) * canvasHeight * 0.6;
                    grapePositions[pIdx + 2] = (Math.random() - 0.5) * 30; // Small Z depth variation

                    const initialLife = 1.5 + Math.random() * 1.5; // seconds
                    grapeLifetimes[i] = initialLife;
                    grapeInitialLifetimes[i] = initialLife; // Store for fade calculation
                    grapeSpawnTimes[i] = currentTime;

                    // Initial color: SBNF Light Lavender
                    const initialColorHue = SBNF_HUES_SCENE.lightLavender;
                    const [r,g,b] = hslToRgb(initialColorHue, 80 + Math.random()*20, 60 + Math.random()*10);
                    grapeColors[pIdx] = r; grapeColors[pIdx + 1] = g; grapeColors[pIdx + 2] = b;

                    grapeTargetSizes[i] = (15 + audioData.bassEnergy * 40 + Math.random() * 10) * Math.max(0.5, settings.brightCap);
                    grapeCurrentSizes[i] = 0.1; // Start small for "pop" animation
                    spawnedThisFrameGrapes++;
                }
            }
        }

        // Update existing live grapes
        for (let i = 0; i < GRAPE_COUNT; i++) {
            if (grapeLifetimes[i] > 0) {
                const pIdx = i * 3;
                grapeLifetimes[i] -= deltaTime;

                const ageMs = currentTime - grapeSpawnTimes[i];
                const lifeRatio = Math.max(0, Math.min(1, ageMs / (grapeInitialLifetimes[i] * 1000 + 0.01) )); // Normalize age (0 to 1)

                // Color "ripening" from Lavender to Orange-Red
                const startHue = SBNF_HUES_SCENE.lightLavender;
                const endHue = SBNF_HUES_SCENE.orangeRed;
                const currentHue = startHue + (endHue - startHue) * lifeRatio;
                const currentSaturation = 90 + (100 - 90) * lifeRatio; // Slightly increase saturation
                const currentLightness = 65 + (55 - 65) * lifeRatio; // Slightly darken as it "ripens"
                const [r,g,b] = hslToRgb(currentHue, currentSaturation, currentLightness);
                grapeColors[pIdx] = r; grapeColors[pIdx + 1] = g; grapeColors[pIdx + 2] = b;

                // Size animation: "pop" then fade
                const popDurationMs = 300;
                if (ageMs < popDurationMs) { // Growing phase
                    grapeCurrentSizes[i] = Math.min(grapeTargetSizes[i], (ageMs / popDurationMs) * grapeTargetSizes[i]);
                } else { // Fading phase (based on remaining lifetime)
                    const remainingLifetimeRatio = Math.max(0, grapeLifetimes[i] / (grapeInitialLifetimes[i] - (popDurationMs / 1000) + 0.01));
                    grapeCurrentSizes[i] = grapeTargetSizes[i] * Math.pow(remainingLifetimeRatio, 2); // Ease out fade
                }
                grapeCurrentSizes[i] = Math.max(0.1, grapeCurrentSizes[i]); // Ensure minimum size if visible

                if (grapeLifetimes[i] <= 0) {
                    grapeCurrentSizes[i] = 0; // Mark as dead by zero size
                }
            } else {
                 grapeCurrentSizes[i] = 0; // Ensure dead particles are size 0
            }
        }
        if (grapeGeometry && grapeGeometry.attributes) {
          if(grapeGeometry.attributes.position) (grapeGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          if(grapeGeometry.attributes.color) (grapeGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
          if(grapeGeometry.attributes.size) (grapeGeometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
        }
      }

      // Procedural vines logic
      if (vinesData && canvasWidth > 0 && canvasHeight > 0) { // Ensure canvas dimensions are valid
        const { activeVines, spawnCooldown, maxVines } = vinesData;
        const hueTimeShift = (currentTime / 10000) * 360; // Slow hue cycle for vines

        // Spawn new vines
        if (audioData.midEnergy > 0.35 && currentTime - (vinesData.lastSpawnTime || 0) > spawnCooldown && activeVines.length < maxVines) {
          vinesData.lastSpawnTime = currentTime;
          vinesData.nextVineId = (vinesData.nextVineId || 0) + 1;
          const newVine: ProceduralVine = {
            id: vinesData.nextVineId,
            points: [],
            color: `hsla(${(SBNF_HUES_SCENE.lightLavender + Math.random() * 60 - 30 + hueTimeShift)%360}, 70%, 65%, 0.7)`, // SBNF Lavender/Purple base
            opacity: 0.7,
            currentLength: 0,
            maxLength: 150 + Math.random() * 150, // Pixels
            spawnTime: currentTime,
            lifetime: 2000 + Math.random() * 2000, // Milliseconds
            thickness: 1 + audioData.midEnergy * 2, // Modulated by audio
            curlFactor: 0.03 + Math.random() * 0.04,
            angle: Math.random() * Math.PI * 2,
            startX: Math.random() < 0.5 ? (Math.random() < 0.5 ? 5 : canvasWidth - 5) : Math.random() * canvasWidth, // Start from edges
            startY: Math.random() < 0.5 ? (Math.random() < 0.5 ? 5 : canvasHeight - 5) : Math.random() * canvasHeight,
            speed: 0.5 + audioData.midEnergy * 1.0, // pixels per frame-ish
          };
          newVine.points.push({ x: newVine.startX, y: newVine.startY });
          activeVines.push(newVine);
        }

        // Update existing vines
        for (let i = activeVines.length - 1; i >= 0; i--) {
          const vine = activeVines[i];
          const age = currentTime - vine.spawnTime;

          if (age > vine.lifetime) {
            activeVines.splice(i, 1); // Remove dead vine
            continue;
          }

          // Update opacity and thickness based on lifetime
          vine.opacity = Math.max(0, 0.7 * (1 - age / vine.lifetime));
          vine.thickness = Math.max(0.5, (1 + audioData.midEnergy * 2) * (1 - age / vine.lifetime));

          // Grow vine if not at max length
          if (vine.currentLength < vine.maxLength && vine.points.length > 0) {
            const lastPoint = vine.points[vine.points.length - 1];
            // Organic curling/wiggling
            const curlInfluence = 0.05 + audioData.trebleEnergy * 0.2; // Treble makes it more wiggly
            const baseCurl = Math.sin(currentTime * 0.0005 * vine.curlFactor + vine.id + vine.points.length * 0.1) * Math.PI * curlInfluence;
            const randomWiggle = (Math.random() - 0.5) * 0.1 * (1 + audioData.trebleEnergy); // More wiggle with treble
            vine.angle += baseCurl * (deltaTime * 50) + randomWiggle; // deltaTime ensures smoother animation regardless of frame rate

            const segmentLength = vine.speed * 1.5 * (1 + audioData.rms * 0.5); // Grow faster with RMS
            let nextX = lastPoint.x + Math.cos(vine.angle) * segmentLength;
            let nextY = lastPoint.y + Math.sin(vine.angle) * segmentLength;

            // Boundary collision (bounce off edges)
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

        // Grape particle cleanup
        if (webGLAssets.grapeGeometry) (webGLAssets.grapeGeometry as THREE.BufferGeometry).dispose();
        if (webGLAssets.grapeMaterial) (webGLAssets.grapeMaterial as THREE.PointsMaterial).dispose();
        if (webGLAssets.grapes && webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(webGLAssets.grapes as THREE.Points);

        // Vine data cleanup (activeVines is just an array of objects, no THREE resources to dispose here unless vines were THREE.Line)
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
        spawnCooldown: 100, // ms
        lastSpawnTime: 0,
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.05), // SBNF Black background
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { geometries, activeShapes, spawnCooldown, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if(bgColor) renderer.setClearColor(bgColor, 0.15); // Fading trail effect

        const numToSpawn = Math.floor(1 + audioData.rms * 2 + (audioData.beat ? 1 : 0)); // Reduced spawn rate slightly
        const maxShapes = 50; // Max shapes on screen

        if ((audioData.beat && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown / 2)) || (audioData.rms > 0.1 && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown))) {
            if (activeShapes.length < maxShapes) {
                webGLAssets.lastSpawnTime = currentTime;
                for (let k = 0; k < numToSpawn && activeShapes.length < maxShapes; k++) {
                    const geometry = geometries[Math.floor(Math.random() * geometries.length)];
                    const material = new THREE.MeshBasicMaterial({
                        transparent: true,
                        opacity: 0.0, // Start invisible, fade in
                        side: THREE.DoubleSide,
                    });
                    const hueTimeShift = (currentTime / 12000) * 360;
                    // SBNF Palette: OrangeRed, OrangeYellow, LightLavender
                    const sbnfShapeHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
                    const baseHue = sbnfShapeHues[Math.floor(Math.random() * sbnfShapeHues.length)];
                    const finalHue = (baseHue + Math.random() * 40 - 20 + hueTimeShift + audioData.trebleEnergy * 30) % 360;

                    const [r,g,b] = hslToRgb(finalHue, 80 + audioData.trebleEnergy * 20, 55 + audioData.midEnergy * 20);
                    material.color.setRGB(r,g,b);

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(
                        (Math.random() - 0.5) * canvasWidth * 0.8,
                        (Math.random() - 0.5) * canvasHeight * 0.8,
                        0
                    );
                    mesh.rotation.z = Math.random() * Math.PI * 2;
                    const initialScale = 0.1 + audioData.bassEnergy * 0.4; // Slightly smaller base scale
                    mesh.scale.set(initialScale, initialScale, initialScale);

                    const shapeData = {
                        mesh,
                        lifetime: 1.2 + Math.random() * 1.2, // Shorter, punchier lifetime
                        initialScale,
                        maxScale: initialScale * (1.4 + audioData.rms * 2.0), // Adjusted max scale
                        currentOpacity: 0,
                        targetOpacity: Math.min(0.75, 0.3 + audioData.rms * 0.6) * settings.brightCap,
                        rotationSpeed: (Math.random() - 0.5) * 0.5 * (1 + audioData.bpm / 120),
                        spawnTime: currentTime,
                        initialLifetime: 0,
                    };
                    shapeData.initialLifetime = shapeData.lifetime; // Set after object creation
                    activeShapes.push(shapeData);
                    scene.add(mesh);
                }
            }
        }

        for (let i = activeShapes.length - 1; i >= 0; i--) {
            const shape = activeShapes[i];
            shape.lifetime -= deltaTime;

            if (shape.lifetime <= 0) {
                scene.remove(shape.mesh);
                if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose();
                activeShapes.splice(i, 1);
                continue;
            }

            const ageRatio = (currentTime - shape.spawnTime) / (shape.initialLifetime * 1000 + 0.001); // Avoid div by zero
            const fadeInDurationRatio = 0.2; 

            if (ageRatio < fadeInDurationRatio) {
                 shape.currentOpacity = Math.min(shape.targetOpacity, shape.targetOpacity * (ageRatio / fadeInDurationRatio) );
            } else {
                const fadeOutProgress = (ageRatio - fadeInDurationRatio) / (1 - fadeInDurationRatio + 0.001);
                shape.currentOpacity = shape.targetOpacity * (1 - Math.pow(fadeOutProgress, 2));
            }
            (shape.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, shape.currentOpacity);

            const scaleProgress = Math.min(1, ageRatio * 1.5); 
            const currentScale = shape.initialScale + (shape.maxScale - shape.initialScale) * Math.sin(scaleProgress * Math.PI * 0.5);
            shape.mesh.scale.set(currentScale, currentScale, currentScale);
            shape.mesh.rotation.z += shape.rotationSpeed * deltaTime;
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

      const ringGeometry = new THREE.RingGeometry(1, 1.05, 64, 1, 0, Math.PI * 2); // Thin ring

      return {
        scene, camera,
        ringGeometry, // Shared geometry for all rings
        activeRings: { // Store active rings for each band
          bass: [],
          mid: [],
          treble: [],
        },
        spawnCooldown: 50, // ms
        lastSpawnTimes: { bass: 0, mid: 0, treble: 0 },
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.03), // SBNF Black
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { ringGeometry, activeRings, spawnCooldown, lastSpawnTimes, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if(bgColor) renderer.setClearColor(bgColor, 0.2); // Fading trail effect

        const bandConfigs = [
            { type: 'bass', ringsArray: activeRings.bass, energy: audioData.bassEnergy, colorHue: SBNF_HUES_SCENE.orangeRed, energyThreshold: 0.15, maxRings: 20 },
            { type: 'mid', ringsArray: activeRings.mid, energy: audioData.midEnergy, colorHue: SBNF_HUES_SCENE.orangeYellow, energyThreshold: 0.1, maxRings: 20 },
            { type: 'treble', ringsArray: activeRings.treble, energy: audioData.trebleEnergy, colorHue: SBNF_HUES_SCENE.lightLavender, energyThreshold: 0.08, maxRings: 20 },
        ];

        bandConfigs.forEach(band => {
            if (band.energy > band.energyThreshold && (currentTime - lastSpawnTimes[band.type] > spawnCooldown / (1 + band.energy * 5)) && band.ringsArray.length < band.maxRings) {
                lastSpawnTimes[band.type] = currentTime;

                const material = new THREE.MeshBasicMaterial({ // Each ring needs its own material for individual opacity/color
                    transparent: true,
                    opacity: 0, // Start invisible
                    side: THREE.DoubleSide,
                });
                const hueTimeShift = (currentTime / 15000) * 360;
                const finalHue = (band.colorHue + (Math.random() * 20 - 10) + hueTimeShift) % 360;
                const [r,g,b] = hslToRgb(finalHue, 90 + band.energy * 10, 50 + band.energy * 25);
                material.color.setRGB(r,g,b);

                const mesh = new THREE.Mesh(ringGeometry, material);
                mesh.scale.set(0.1, 0.1, 1); // Start small
                const ringData = {
                    mesh,
                    lifetime: 0.8 + band.energy * 1.2,
                    initialScale: 0.1,
                    maxScale: (Math.min(canvasWidth, canvasHeight) * 0.45) * (0.4 + band.energy * 0.9),
                    targetOpacity: Math.min(0.7, 0.25 + band.energy * 0.6) * settings.brightCap,
                    currentOpacity: 0,
                    spawnTime: currentTime,
                    initialLifetime: 0,
                };
                ringData.initialLifetime = ringData.lifetime;
                band.ringsArray.push(ringData);
                scene.add(mesh);
            }

            for (let i = band.ringsArray.length - 1; i >= 0; i--) {
                const ring = band.ringsArray[i];
                ring.lifetime -= deltaTime;

                if (ring.lifetime <= 0) {
                    scene.remove(ring.mesh);
                    if(ring.mesh.material) (ring.mesh.material as THREE.Material).dispose();
                    band.ringsArray.splice(i, 1);
                    continue;
                }
                const ageRatio = (currentTime - ring.spawnTime) / (ring.initialLifetime * 1000 + 0.001);
                const fadeInDurationRatio = 0.25; 

                if (ageRatio < fadeInDurationRatio) {
                    ring.currentOpacity = Math.min(ring.targetOpacity, ring.targetOpacity * (ageRatio / fadeInDurationRatio));
                } else { 
                    const fadeOutProgress = (ageRatio - fadeInDurationRatio) / (1 - fadeInDurationRatio + 0.001);
                    ring.currentOpacity = ring.targetOpacity * (1 - Math.pow(fadeOutProgress, 2)); 
                }
                (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ring.currentOpacity);

                const currentScale = ring.initialScale + (ring.maxScale - ring.initialScale) * Math.pow(ageRatio, 0.7); 
                ring.mesh.scale.set(currentScale, currentScale, 1);
            }
        });
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        Object.values(webGLAssets.activeRings as any).forEach((ringArray: any) => {
            ringArray.forEach((ring: any) => {
                if (ring.mesh) {
                    if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(ring.mesh);
                    if(ring.mesh.material) ring.mesh.material.dispose();
                }
            });
        });
        webGLAssets.activeRings = { bass: [], mid: [], treble: [] };
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

      const GRID_SIZE_X = 16;
      const GRID_SIZE_Y = Math.round(GRID_SIZE_X * (canvas.height / canvas.width)) || 1; // Ensure at least 1
      const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

      const cellGeometry = new THREE.PlaneGeometry(1, 1); // Base geometry
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
            dummy.scale.set(cellBaseWidth * 0.85, cellBaseHeight * 0.85, 1); // Slightly smaller for gaps
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
            instancedMesh.setColorAt(i, tempColor.setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.6, 0.1)); // Initial dim SBNF Purple
            cellStates.push({
                targetHue: SBNF_HUES_SCENE.deepPurple,
                targetSaturation: 0.6,
                targetLightness: 0.1,
                currentLightness: 0.1,
                lastPulseTime: 0,
            });
        }
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      return {
        scene, camera, instancedMesh, cellStates, GRID_SIZE_X, GRID_SIZE_Y, totalCells,
        cellBaseWidth, cellBaseHeight, tempColor,
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.02), // SBNF Black background
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { instancedMesh, cellStates, GRID_SIZE_X, GRID_SIZE_Y, totalCells, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        webGLAssets.lastFrameTimeWebGL = currentTime; // For potential deltaTime use later

        if(bgColor) renderer.setClearColor(bgColor, 0.1); // Fading trail

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;
        if (!spectrum || spectrumLength === 0) return;

        for (let i = 0; i < totalCells; i++) {
            const state = cellStates[i];
            const spectrumIndex = Math.min(spectrumLength - 1, Math.floor((i / totalCells) * spectrumLength));
            const energy = (spectrum[spectrumIndex] || 0) / 255;

            const pulseThreshold = 0.15 + (i % 5) * 0.02;
            if (energy > pulseThreshold && currentTime - state.lastPulseTime > (50 + Math.random() * 50)) { // Cooldown
                state.lastPulseTime = currentTime;
                const sbnfPulseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];
                state.targetHue = (sbnfPulseHues[Math.floor(Math.random() * sbnfPulseHues.length)] + energy * 20 + (i * 3) + (currentTime/600)) % 360;
                state.targetSaturation = 0.85 + energy * 0.15; // More saturated on pulse
                state.targetLightness = 0.30 + energy * 0.45 * settings.brightCap; // Brighter pulse
            } else {
                state.targetLightness *= 0.96; // Faster fade for inactive cells
                state.targetLightness = Math.max(0.03, state.targetLightness); // Minimum dimness
                state.targetSaturation = 0.6; // Revert to base saturation
            }
            state.currentLightness += (state.targetLightness - state.currentLightness) * 0.15;

            const [r,g,b] = hslToRgb(state.targetHue, state.targetSaturation * 100, state.currentLightness * 100);
            tempColor.setRGB(r,g,b);
            if (instancedMesh.instanceColor) instancedMesh.setColorAt(i, tempColor);
        }
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets && webGLAssets.instancedMesh) {
            (webGLAssets.instancedMesh as THREE.InstancedMesh).geometry.dispose();
            ((webGLAssets.instancedMesh as THREE.InstancedMesh).material as THREE.Material).dispose();
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
      const barBaseWidth = (canvas.width / numBars) * 0.75;

      const barGeometry = new THREE.PlaneGeometry(1, 1); 
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      scene.add(instancedMesh);

      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();

      for (let i = 0; i < numBars; i++) {
        const xPosition = (i - numBars / 2 + 0.5) * (canvas.width / numBars);
        dummy.position.set(xPosition, -canvas.height / 2, 0);
        dummy.scale.set(barBaseWidth, 1, 1);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, tempColor.setHSL(SBNF_HUES_SCENE.deepPurple/360, 0.6, 0.1));
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      return {
        scene, camera, instancedMesh, numBars, barBaseWidth, dummy, tempColor,
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.47),
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { instancedMesh, numBars, barBaseWidth, dummy, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if(bgColor) renderer.setClearColor(bgColor, 1);

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;
        if (!spectrum || spectrumLength === 0) return;

        for (let i = 0; i < numBars; i++) {
            if (i >= spectrumLength) continue;

            const value = spectrum[i] / 255;
            const barHeight = Math.max(1, value * canvasHeight * 0.8 * settings.brightCap * (1 + audioData.rms * 0.5));

            const xPosition = (i - numBars / 2 + 0.5) * (canvasWidth / numBars);
            const yPosition = -canvasHeight / 2 + barHeight / 2;

            dummy.position.set(xPosition, yPosition, 0);
            dummy.scale.set(barBaseWidth, barHeight, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            const hueTimeShift = (currentTime / 9000 * 360 + i * 7) % 360;
            let baseHue;
            if (value < 0.33) baseHue = SBNF_HUES_SCENE.lightLavender;
            else if (value < 0.66) baseHue = SBNF_HUES_SCENE.orangeYellow;
            else baseHue = SBNF_HUES_SCENE.orangeRed;

            const finalHue = (baseHue + hueTimeShift + (audioData.beat && (i%3===0) ? 45 : 0)) % 360;
            const saturation = 0.75 + value * 0.25 + audioData.rms * 0.15;
            const lightness = 0.35 + value * 0.4 + audioData.rms * 0.15;

            const [r,g,b] = hslToRgb(finalHue, Math.min(1, saturation) * 100, Math.min(0.75, lightness) * 100);
            tempColor.setRGB(r,g,b);
            if (instancedMesh.instanceColor) instancedMesh.setColorAt(i, tempColor);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets && webGLAssets.instancedMesh) {
            (webGLAssets.instancedMesh as THREE.InstancedMesh).geometry.dispose();
            ((webGLAssets.instancedMesh as THREE.InstancedMesh).material as THREE.Material).dispose();
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
      camera.position.z = 300;

      const PARTICLE_COUNT = 4000;
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT);
      const initialLifetimes = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes[i] = 0; 
        const pIdx = i * 3;
        positions[pIdx] = positions[pIdx+1] = positions[pIdx+2] = 10000;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 5 * settings.brightCap,
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
        positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT,
        tempColor: new THREE.Color(), lastBeatTime: 0, lastAmbientSpawnTime: 0,
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.01), // SBNF Black
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const { particles, particleMaterial, particleGeometry, positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT, tempColor, bgColor } = webGLAssets as any;
      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (bgColor) renderer.setClearColor(bgColor, 0.1);

      const beatCooldown = 100; 
      const ambientSpawnRate = 0.03;
      let spawnedThisFrame = 0;

      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
        webGLAssets.lastBeatTime = currentTime;
        const maxBurstParticlesThisBeat = Math.floor(PARTICLE_COUNT * (0.08 + audioData.bassEnergy * 0.25));
        let burstSpawned = 0;
        for (let i = 0; i < PARTICLE_COUNT && burstSpawned < maxBurstParticlesThisBeat; i++) {
          if (lifetimes[i] <= 0) {
            const pIdx = i * 3;
            positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;

            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos((Math.random() * 2) - 1);
            const speed = 100 + (audioData.bassEnergy + audioData.rms) * 200 + Math.random() * 50;
            velocities[pIdx] = speed * Math.sin(theta) * Math.cos(phi);
            velocities[pIdx + 1] = speed * Math.sin(theta) * Math.sin(phi);
            velocities[pIdx + 2] = speed * Math.cos(theta);

            const life = 1.0 + Math.random() * 1.5;
            lifetimes[i] = life;
            initialLifetimes[i] = life;

            const burstHue = Math.random() < 0.7 ? SBNF_HUES_SCENE.orangeRed : SBNF_HUES_SCENE.orangeYellow;
            const [r,g,b] = hslToRgb(burstHue, 90 + Math.random() * 10, 50 + Math.random() * 20);
            colors[pIdx] = r; colors[pIdx + 1] = g; colors[pIdx + 2] = b;
            burstSpawned++;
            spawnedThisFrame++;
          }
        }
      }

      const numAmbientToSpawn = Math.floor(PARTICLE_COUNT * ambientSpawnRate * deltaTime * (0.2 + audioData.rms * 2));
      let ambientSpawned = 0;
      if(currentTime - webGLAssets.lastAmbientSpawnTime > 50 && audioData.rms > 0.05){
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

                const life = 2.0 + Math.random() * 2.0;
                lifetimes[i] = life;
                initialLifetimes[i] = life;

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
        const pIdx = i * 3;
        if (lifetimes[i] > 0) {
          positions[pIdx] += velocities[pIdx] * deltaTime;
          positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
          positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

          velocities[pIdx] *= dragFactor;
          velocities[pIdx + 1] *= dragFactor;
          velocities[pIdx + 2] *= dragFactor;

          lifetimes[i] -= deltaTime;
          const lifeRatio = Math.max(0, lifetimes[i] / (initialLifetimes[i] + 0.001) );
          
          // Preserve base color, fade alpha (implicitly via PointsMaterial opacity or by modifying color attributes directly)
          // For this example, we assume vertex colors are used for fade.
          const originalColor = tempColor.setRGB(colors[pIdx], colors[pIdx+1], colors[pIdx+2]); // Assume colors store base color
          const fadedColor = originalColor.multiplyScalar(Math.pow(lifeRatio, 1.5));
          colors[pIdx] = fadedColor.r;
          colors[pIdx + 1] = fadedColor.g;
          colors[pIdx + 2] = fadedColor.b;


          if (lifetimes[i] <= 0) {
            positions[pIdx] = 10000; positions[pIdx+1] = 10000; positions[pIdx+2] = 10000;
          }
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
        camera.position.z = 0; // Start inside the tunnel

        const NUM_SEGMENTS = 25;
        const SEGMENT_DEPTH = 80; // Spacing between segments
        const tunnelSegments: THREE.Mesh[] = [];

        // Use TorusGeometry for a more rounded, Tron-like segment
        const segmentGeometry = new THREE.TorusGeometry(100, 3, 8, 32); // radius, tube, radialSegments, tubularSegments

        for (let i = 0; i < NUM_SEGMENTS; i++) {
            const material = new THREE.MeshBasicMaterial({ wireframe: true }); // Wireframe for Tron look
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
            cameraZSpeed: 50, // Base speed
        } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { tunnelSegments, NUM_SEGMENTS, SEGMENT_DEPTH, tempColor, cameraBaseFov, cameraZSpeed } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        renderer.setClearColor(SBNF_HUES_SCENE.black, 1); // Solid black background for Tron

        const speedBoost = 1 + audioData.rms * 2.5 + (audioData.beat ? 1.5 : 0);
        camera.position.z -= cameraZSpeed * speedBoost * deltaTime;

        // Tron color palette
        const tronBlueHue = SBNF_HUES_SCENE.tronBlue;
        const tronPinkHue = SBNF_HUES_SCENE.tronPink;
        const sbnfOrangeRedHue = SBNF_HUES_SCENE.orangeRed;

        tunnelSegments.forEach((segment: THREE.Mesh, i: number) => {
            // Recycle segments
            if (segment.position.z > camera.position.z + SEGMENT_DEPTH) { // Check if segment is behind camera + one segment depth
                segment.position.z -= NUM_SEGMENTS * SEGMENT_DEPTH; // Move it to the front of the tunnel
            }

            // Color cycling and audio reactivity for Tron aesthetic
            let baseHue = (i % 3 === 0) ? tronPinkHue : tronBlueHue;
            let saturation = 80;
            let lightness = 40 + audioData.trebleEnergy * 30;

            if (audioData.beat && i % (Math.floor(1 + audioData.bassEnergy * 4)) === 0) { // Flash some segments orange on beat
                baseHue = sbnfOrangeRedHue;
                saturation = 95;
                lightness = 55 + audioData.bassEnergy * 20;
            }
            const hueTimeShift = (currentTime / 8000 * 360 + i * 15) % 360; // Slower, more distinct color shifts
            const finalHue = (baseHue + hueTimeShift) % 360;

            (segment.material as THREE.MeshBasicMaterial).color.setHSL(
                finalHue / 360,
                saturation / 100,
                Math.min(0.75, lightness / 100) * settings.brightCap // Ensure brightness cap is respected
            );

            // Subtle scale and rotation effects
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
            (webGLAssets.tunnelSegments as THREE.Mesh[]).forEach((segment: THREE.Mesh) => {
                if(webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(segment);
                segment.geometry.dispose();
                (segment.material as THREE.Material).dispose();
            });
            webGLAssets.tunnelSegments = [];
            // If segmentGeometry was shared and stored in webGLAssets, dispose it here too.
            // In this case, each segment creates its own material but shares geometry if we optimized it that way.
            // For simplicity, assuming distinct material per segment, but potentially shared geometry.
            // If geometry is unique per segment, its disposal within the loop is fine.
            // If a single segmentGeometry was created in initWebGL and cloned for each mesh, dispose the original here.
            if (webGLAssets.segmentGeometry) (webGLAssets.segmentGeometry as THREE.BufferGeometry).dispose();

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
      // Orthographic camera for a full-screen quad effect
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const planeGeometry = new THREE.PlaneGeometry(2, 2); // Covers the entire viewport
      const planeMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0), // Start black
          transparent: false, // Strobe should be opaque when flashing
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(planeMesh);
      planeMesh.visible = false; // Start with the flash off

      return {
        scene, camera, planeMesh, planeMaterial, tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
        bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0), // SBNF Black
      } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
        const { planeMesh, planeMaterial, tempColor, bgColor } = webGLAssets as any;

        if(bgColor) renderer.setClearColor(bgColor, 1); // Ensure background is SBNF black

        // Flash on beat if RMS is also above a small threshold to avoid strobing on silence
        if (audioData.beat && audioData.rms > 0.03) {
            planeMesh.visible = true;
            // SBNF Strobe Colors: OrangeRed, OrangeYellow, LightPeach (or Cream #FFECDA)
            const strobeHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
            const hue = strobeHues[Math.floor(Math.random() * strobeHues.length)];
            const [r,g,b] = hslToRgb(hue, 95 + Math.random() * 5, Math.min(100, 75 + audioData.rms * 25) * settings.brightCap / 100); // Bright flash, modulated by brightCap
            tempColor.setRGB(r,g,b);
            planeMaterial.color.copy(tempColor);
        } else {
            planeMesh.visible = false; // Turn off the flash
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
        camera.position.z = 400;

        const PARTICLE_COUNT = 3000; // Reduced from 3500
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const colors = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);
        const lifetimes = new Float32Array(PARTICLE_COUNT);
        const initialLifetimes = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            lifetimes[i] = 0;
            const pIdx = i * 3;
            positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 10000; // Move off-screen
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 5 * settings.brightCap, // Slightly smaller base size
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
            positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT,
            tempColor: new THREE.Color(), lastBeatTime: 0,
            lastFrameTimeWebGL: performance.now(),
            cameraBaseFov: 75,
            cameraBaseZ: 400,
            bgColor: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.01), // SBNF Black
        } as Omit<WebGLSceneAssets, 'renderer'>;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { particles, particleMaterial, particleGeometry, positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT, tempColor, bgColor, cameraBaseFov, cameraBaseZ } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime)) / 1000.0;
        webGLAssets.lastFrameTimeWebGL = currentTime;

        if (bgColor) renderer.setClearColor(bgColor, 0.08); // Slightly faster fade for clarity

        camera.fov = cameraBaseFov - audioData.rms * 10 * settings.gamma; // Less drastic FOV change
        camera.fov = Math.max(60, Math.min(80, camera.fov));
        camera.position.z = cameraBaseZ - audioData.rms * 50; // Less drastic Z change
        camera.updateProjectionMatrix();

        const beatCooldown = 120;
        const particlesToSpawnOnBeatBase = Math.floor(PARTICLE_COUNT * 0.10); // Base spawn reduced
        const particlesToSpawnOnBeatMax = Math.floor(PARTICLE_COUNT * 0.20); // Max spawn reduced
        let spawnedThisBeat = 0;

        if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            const particlesToSpawn = Math.min(particlesToSpawnOnBeatMax, particlesToSpawnOnBeatBase + Math.floor(audioData.bassEnergy * PARTICLE_COUNT * 0.15));

            for (let i = 0; i < PARTICLE_COUNT && spawnedThisBeat < particlesToSpawn; i++) {
                if (lifetimes[i] <= 0) {
                    const pIdx = i * 3;
                    positions[pIdx] = (Math.random() - 0.5) * 5;
                    positions[pIdx + 1] = (Math.random() - 0.5) * 5;
                    positions[pIdx + 2] = (Math.random() - 0.5) * 5;

                    const phi = Math.random() * Math.PI * 2;
                    const theta = Math.acos((Math.random() * 2) - 1);
                    const speed = 100 + (audioData.bassEnergy * 120) + (audioData.rms * 60) + Math.random() * 40; // Reduced speed multipliers
                    velocities[pIdx] = speed * Math.sin(theta) * Math.cos(phi);
                    velocities[pIdx + 1] = speed * Math.sin(theta) * Math.sin(phi);
                    velocities[pIdx + 2] = speed * Math.cos(theta);

                    const life = 1.5 + Math.random() * 1.8; // Slightly shorter lifetimes for punchier bursts
                    lifetimes[i] = life;
                    initialLifetimes[i] = life;

                    const burstHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
                    const hue = burstHues[Math.floor(Math.random() * burstHues.length)];
                    const baseLightness = 40 + Math.random() * 15; // Range 40-55, less bright
                    const lightnessVariation = (audioData.beat ? 5 : 0) + (audioData.rms * 10);
                    const finalLightness = Math.min(65, baseLightness + lightnessVariation); // Cap lightness to avoid pure white
                    const [r,g,b] = hslToRgb(hue, 80 + Math.random() * 15, finalLightness); // Slightly less saturation
                    colors[pIdx] = r; colors[pIdx + 1] = g; colors[pIdx + 2] = b;

                    spawnedThisBeat++;
                }
            }
        }

        const dragFactor = 0.965;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const pIdx = i * 3;
          if (lifetimes[i] > 0) {
            positions[pIdx] += velocities[pIdx] * deltaTime;
            positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
            positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

            velocities[pIdx] *= dragFactor;
            velocities[pIdx + 1] *= dragFactor;
            velocities[pIdx + 2] *= dragFactor;

            lifetimes[i] -= deltaTime;
            const lifeRatio = Math.max(0, lifetimes[i] / (initialLifetimes[i] + 0.001));
            
            // Directly use the stored color components, then apply fade
            // The color is set on spawn, here we just fade it.
            const originalR = colors[pIdx]; 
            const originalG = colors[pIdx+1];
            const originalB = colors[pIdx+2];

            // This logic might be problematic if colors are not reset properly on respawn.
            // Assuming colors array holds the "full brightness" color from spawn.
            // To fade alpha with PointsMaterial, you'd typically set material.opacity.
            // To fade vertex colors, you multiply them by the fade factor.
            // Let's ensure we are not multiplying an already faded color.
            // It's safer to store base colors and calculate faded ones each frame,
            // or manipulate alpha if the shader/material supported per-particle alpha.
            // For now, simple multiplication is used, assuming colors are "reset" on respawn logic.
            tempColor.setRGB(originalR, originalG, originalB); // Load current color
            tempColor.multiplyScalar(Math.pow(lifeRatio, 0.6)); // Apply fade
            colors[pIdx] = tempColor.r;
            colors[pIdx + 1] = tempColor.g;
            colors[pIdx + 2] = tempColor.b;


            if (lifetimes[i] <= 0) {
                positions[pIdx] = 10000; positions[pIdx + 1] = 10000; positions[pIdx + 2] = 10000;
                velocities[pIdx] = velocities[pIdx + 1] = velocities[pIdx + 2] = 0;
                // Optionally reset colors to 0 here if not handled by spawn logic fully
                // colors[pIdx] = colors[pIdx+1] = colors[pIdx+2] = 0;
            }
          } else {
              positions[pIdx] = 10000; positions[pIdx+1] = 10000; positions[pIdx+2] = 10000;
          }
        }

        if (particleGeometry && particleGeometry.attributes.position) particleGeometry.attributes.position.needsUpdate = true;
        if (particleGeometry && particleGeometry.attributes.color) particleGeometry.attributes.color.needsUpdate = true;
        particleMaterial.size = (3 + audioData.rms * 8) * settings.brightCap; // Reduced size reactivity
        particleMaterial.opacity = Math.min(0.75, 0.30 + audioData.rms * 0.8) * settings.brightCap; // Reduced opacity reactivity

        particles.rotation.x += audioData.midEnergy * 0.0002; // Slower rotation
        particles.rotation.y += audioData.trebleEnergy * 0.0003;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.particleGeometry) (webGLAssets.particleGeometry as THREE.BufferGeometry).dispose();
            if (webGLAssets.particleMaterial) (webGLAssets.particleMaterial as THREE.PointsMaterial).dispose();
        }
    }
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";

// SBNF Hues (already defined above)
// const SBNF_HUES = {
//   black: 0, orangeRed: 13, orangeYellow: 36, lightPeach: 30, lightLavender: 267, deepPurple: 258,
//   tronBlue: 197, tronPink: 337,
// };
// Helper to convert HSL to RGB (already defined above)
// function hslToRgb(h: number, s: number, l: number): [number, number, number] { ... }
// Helper to generate noise texture (already defined above)
// function generateNoiseTexture(width: number, height: number): THREE.DataTexture { ... }
