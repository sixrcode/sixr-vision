
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
    // Simple pseudo-random noise, not true Perlin. For actual Perlin, a library or more complex algo is needed.
    let val = Math.random(); // Basic random
    // A very basic way to get some variation like Perlin might give
    val = (Math.sin(x * Math.PI * 5 + Math.random()*0.2) + Math.cos(y * Math.PI * 7 + Math.random()*0.3)) / 2;
    val = (val + 1) / 2; // Normalize to 0-1

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
  showWebcam: true, // Default webcam to ON
  mirrorWebcam: true, // Default mirror to ON
  currentSceneId: 'radial_burst',
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse',
    speed: 1,
    color: '#FF441A',
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FFECDA.png?text=Mirror&font=poppins',
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const webGLAssets: Partial<WebGLSceneAssets> & { lastCanvasWidth?: number, lastCanvasHeight?: number, vinesData?: any, GRAPE_COUNT?: number, lastGrapeSpawnTime?: number } = {
        scene,
        camera,
        lastCanvasWidth: 0,
        lastCanvasHeight: 0,
        noiseTexture: generateNoiseTexture(256, 256),
        vinesData: { activeVines: [], nextVineId: 0, lastSpawnTime: 0, spawnCooldown: 200, maxVines: 15 },
        GRAPE_COUNT: 200, // Number of grape particles
        lastGrapeSpawnTime: 0,
        tempColor: new THREE.Color(), // Reusable color object
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
          uniform vec2 u_resolution; // For potential aspect ratio corrections or effects

          varying vec2 vUv;

          // Basic Fresnel approximation for a plane viewed head-on
          float fresnelEffect(vec2 uv_coords) {
            float edgeFactor = pow(1.0 - 2.0 * abs(uv_coords.x - 0.5), 3.0) +
                               pow(1.0 - 2.0 * abs(uv_coords.y - 0.5), 3.0);
            return clamp(edgeFactor, 0.0, 1.0);
          }

          void main() {
            if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard; // Item 4: Throttle shader work

            vec2 texCoord = vUv; // Already mirrored by vertex shader if u_mirrorX is true

            vec4 webcamColor = texture2D(u_webcamTexture, texCoord);
            float luma = dot(webcamColor.rgb, vec3(0.299, 0.587, 0.114));
            
            // Softer silhouette mask based on luma
            float silhouetteMask = smoothstep(0.3, 0.6, luma); 

            // Scrolling noise for fill
            vec2 noiseUv = vUv * 2.0 + vec2(u_time * 0.05, u_time * 0.03);
            vec3 noiseVal = texture2D(u_noiseTexture, noiseUv).rgb;

            // Dynamic fill color based on noise and audio-reactive colors
            vec3 fillColor = mix(u_fillColor1, u_fillColor2, noiseVal.r);

            // Fresnel for rim lighting
            float rim = fresnelEffect(vUv);

            vec3 finalColor = vec3(0.0);
            float finalAlpha = 0.0;

            if (silhouetteMask > 0.1) { // If considered part of the silhouette
              finalColor = mix(fillColor, u_rimColor, rim * 0.8); // Blend fill with rim color at edges
              finalAlpha = silhouetteMask * u_opacityFactor;
            } else { // If considered background
              finalAlpha = 0.0; 
            }
            
            // Ensure webcam's own alpha contributes if it has one (e.g. from future segmentation)
            finalAlpha *= webcamColor.a;
            
            // Compensate alpha for discarded pixels
            gl_FragColor = vec4(finalColor, clamp(finalAlpha * 1.85, 0.0, 1.0));
          }
        `;
        const shaderMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            u_webcamTexture: { value: videoTexture },
            u_noiseTexture: { value: webGLAssets.noiseTexture },
            u_rimColor: { value: new THREE.Color(SBNF_HUES_SCENE.orangeYellow) },
            u_fillColor1: { value: new THREE.Color(SBNF_HUES_SCENE.deepPurple) },
            u_fillColor2: { value: new THREE.Color(SBNF_HUES_SCENE.lightLavender) },
            u_opacityFactor: { value: 1.0 },
            u_mirrorX: { value: settings.mirrorWebcam },
            u_time: { value: 0.0 },
            u_resolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
          },
          transparent: true,
          depthWrite: false, // Important for blending silhouette correctly
        });
        webGLAssets.shaderMaterial = shaderMaterial;

        const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        webGLAssets.planeMesh = planeMesh;

        // Grape particles setup
        const GRAPE_COUNT = webGLAssets.GRAPE_COUNT || 200;
        const grapePositions = new Float32Array(GRAPE_COUNT * 3);
        const grapeColors = new Float32Array(GRAPE_COUNT * 3);
        const grapeCurrentSizes = new Float32Array(GRAPE_COUNT); // Use this for actual size
        const grapeTargetSizes = new Float32Array(GRAPE_COUNT); // Target size for animation
        const grapeLifetimes = new Float32Array(GRAPE_COUNT);
        const grapeSpawnTimes = new Float32Array(GRAPE_COUNT);

        for (let i = 0; i < GRAPE_COUNT; i++) {
          grapeLifetimes[i] = 0; // Initialize as "dead"
        }

        const grapeGeometry = new THREE.BufferGeometry();
        grapeGeometry.setAttribute('position', new THREE.BufferAttribute(grapePositions, 3));
        grapeGeometry.setAttribute('color', new THREE.BufferAttribute(grapeColors, 3));
        grapeGeometry.setAttribute('size', new THREE.BufferAttribute(grapeCurrentSizes, 1)); // Attribute for shader-based size
        
        const grapeMaterial = new THREE.PointsMaterial({
          // size: 1.0, // Base size, actual size controlled by attribute
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true, // Allows per-particle size if shader handles 'size' attribute
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
        // Fallback: clear to a theme color if webcam not ready
        webGLAssets.bgColor = new THREE.Color(SBNF_HUES_SCENE.deepPurple);
      }
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      if (!renderer || !scene || !camera || !webGLAssets) {
        if(renderer && webGLAssets?.bgColor) renderer.setClearColor((webGLAssets.bgColor as THREE.Color).getHex(), 1.0);
        return;
      }
      
      const { planeMesh, shaderMaterial, videoTexture, bgColor, noiseTexture,
              grapes, grapeGeometry, grapeMaterial, grapePositions, grapeColors, grapeTargetSizes, grapeCurrentSizes,
              grapeLifetimes, grapeSpawnTimes, GRAPE_COUNT, tempColor, vinesData
       } = webGLAssets as any; // Using 'any' for webGLAssets for simplicity in this context

      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime-16)) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      // Update shader uniforms if material exists
      if (shaderMaterial) {
        shaderMaterial.uniforms.u_time.value = currentTime * 0.001;
        if (shaderMaterial.uniforms.u_resolution) shaderMaterial.uniforms.u_resolution.value.set(canvasWidth, canvasHeight);
      }

      // Handle webcam plane visibility and updates
      if (planeMesh && shaderMaterial && videoTexture && settings.showWebcam && webcamElement && webcamElement.readyState >= webcamElement.HAVE_ENOUGH_DATA) {
        renderer.setClearAlpha(0.15); // Keep trails for silhouette
        renderer.setClearColor(bgColor ? (bgColor as THREE.Color).getHex() : SBNF_HUES_SCENE.black, renderer.getClearAlpha());
        
        if(videoTexture.image !== webcamElement) videoTexture.image = webcamElement; // Ensure texture uses current element
        videoTexture.needsUpdate = true;
        shaderMaterial.uniforms.u_mirrorX.value = settings.mirrorWebcam;
        
        // Audio-reactive opacity and colors for shader
        const baseOpacity = settings.brightCap * (0.6 + audioData.rms * 0.6); // Slightly more opaque base
        shaderMaterial.uniforms.u_opacityFactor.value = Math.min(1.0, baseOpacity);

        const hueTimeShift = (currentTime / 20000) * 360; // Slow continuous hue shift

        const rimBaseHue = (SBNF_HUES_SCENE.orangeYellow + audioData.trebleEnergy * 60 + hueTimeShift) % 360;
        shaderMaterial.uniforms.u_rimColor.value.setHSL(rimBaseHue / 360, 0.95, 0.60 + audioData.beat * 0.15);

        const fill1BaseHue = (SBNF_HUES_SCENE.deepPurple + audioData.bassEnergy * 50 + hueTimeShift * 0.7) % 360;
        shaderMaterial.uniforms.u_fillColor1.value.setHSL(fill1BaseHue / 360, 0.7, 0.25 + audioData.midEnergy * 0.2);
        
        const fill2BaseHue = (SBNF_HUES_SCENE.lightLavender + audioData.midEnergy * 70 + hueTimeShift * 1.3) % 360;
        shaderMaterial.uniforms.u_fillColor2.value.setHSL(fill2BaseHue / 360, 0.8, 0.40 + audioData.trebleEnergy * 0.25);

        // Item 5: Only resize geometry when the canvas really changed
        if (webGLAssets.lastCanvasWidth !== canvasWidth || webGLAssets.lastCanvasHeight !== canvasHeight) {
          if (planeMesh.geometry) planeMesh.geometry.dispose();
          planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
          webGLAssets.lastCanvasWidth = canvasWidth;
          webGLAssets.lastCanvasHeight = canvasHeight;
        }
        planeMesh.visible = true;
      } else {
        if (planeMesh) planeMesh.visible = false;
        renderer.setClearColor(bgColor ? (bgColor as THREE.Color).getHex() : SBNF_HUES_SCENE.deepPurple, 1); // Solid background if no webcam
      }

      // Grape particles logic
      if (grapes && grapeLifetimes && grapePositions && grapeColors && grapeCurrentSizes && grapeTargetSizes && grapeSpawnTimes && tempColor && GRAPE_COUNT) {
        const beatCooldown = 150; // ms between beat-triggered spawns
        let spawnedThisFrameGrapes = 0;
        const maxSpawnPerBeatGrapes = Math.floor(GRAPE_COUNT * 0.15); // Spawn up to 15% of particles on a beat

        if (audioData.beat && (currentTime - (webGLAssets.lastGrapeSpawnTime || 0) > beatCooldown) && spawnedThisFrameGrapes < maxSpawnPerBeatGrapes) {
            webGLAssets.lastGrapeSpawnTime = currentTime;
            let grapesToSpawnCount = Math.floor(GRAPE_COUNT * (0.05 + audioData.bassEnergy * 0.2)); // More sensitive to bass
            grapesToSpawnCount = Math.min(grapesToSpawnCount, GRAPE_COUNT); // Cap at total

            for (let i = 0; i < GRAPE_COUNT && spawnedThisFrameGrapes < grapesToSpawnCount; i++) {
                if (grapeLifetimes[i] <= 0) { // Find a "dead" particle
                    const pIdx = i * 3;
                    // Spawn near center, but with slight randomness
                    grapePositions[pIdx] = (Math.random() - 0.5) * canvasWidth * 0.1;
                    grapePositions[pIdx + 1] = (Math.random() - 0.5) * canvasHeight * 0.1;
                    grapePositions[pIdx + 2] = (Math.random() - 0.5) * 50; // Depth randomness

                    grapeLifetimes[i] = 1.5 + Math.random() * 1.5; // seconds
                    grapeSpawnTimes[i] = currentTime;
                    
                    const initialColorHue = SBNF_HUES_SCENE.lightLavender; // Start as lavender
                    const [r,g,b] = hslToRgb(initialColorHue, 80 + Math.random()*20, 60 + Math.random()*10);
                    tempColor.setRGB(r,g,b);
                    grapeColors[pIdx] = tempColor.r;
                    grapeColors[pIdx + 1] = tempColor.g;
                    grapeColors[pIdx + 2] = tempColor.b;
                    
                    grapeTargetSizes[i] = (15 + audioData.bassEnergy * 40 + Math.random() * 10) * Math.max(0.5, settings.brightCap); // Scale with brightCap
                    grapeCurrentSizes[i] = 0.1; // Start small for pop-in
                    spawnedThisFrameGrapes++;
                }
            }
        }

        // Update existing live grapes
        for (let i = 0; i < GRAPE_COUNT; i++) {
            if (grapeLifetimes[i] > 0) {
                const pIdx = i * 3;
                grapeLifetimes[i] -= deltaTime;
                
                const ageMs = (currentTime - grapeSpawnTimes[i]);
                const initialLifetimeMs = (grapeLifetimes[i] / deltaTime) * 16.67 + ageMs; // Approximate initial lifetime
                const lifeRatio = Math.max(0, Math.min(1, ageMs / (initialLifetimeMs + 0.01) )); // Ensure no div by zero

                // Color transition: Lavender -> Orange/Red (ripening)
                const startHue = SBNF_HUES_SCENE.lightLavender;
                const endHue = SBNF_HUES_SCENE.orangeRed;
                const currentHue = startHue + (endHue - startHue) * lifeRatio;
                const currentSaturation = 90 + (100 - 90) * lifeRatio; // Slightly more saturated as it ripens
                const currentLightness = 65 + (55 - 65) * lifeRatio; // Slightly darker as it ripens
                const [r,g,b] = hslToRgb(currentHue, currentSaturation, currentLightness);
                tempColor.setRGB(r,g,b);
                grapeColors[pIdx] = tempColor.r;
                grapeColors[pIdx + 1] = tempColor.g;
                grapeColors[pIdx + 2] = tempColor.b;

                // Size animation: Pop-in, then fade
                const popDurationMs = 300; 
                if (ageMs < popDurationMs) { // Grow-in phase
                    grapeCurrentSizes[i] = Math.min(grapeTargetSizes[i], (ageMs / popDurationMs) * grapeTargetSizes[i]);
                } else { // Fade-out phase (based on remaining lifetime)
                    const remainingLifetimeRatio = Math.max(0, grapeLifetimes[i] / ((initialLifetimeMs / 1000) - (popDurationMs / 1000) + 0.01));
                    grapeCurrentSizes[i] = grapeTargetSizes[i] * Math.pow(remainingLifetimeRatio, 2);
                }
                grapeCurrentSizes[i] = Math.max(0.1, grapeCurrentSizes[i]);


                if (grapeLifetimes[i] <= 0) {
                    grapeCurrentSizes[i] = 0; // Mark as dead for shader
                    grapePositions[pIdx + 1] = -canvasHeight * 2; // Move off-screen (optional, if not using size=0)
                }
            } else {
                 grapeCurrentSizes[i] = 0; // Ensure dead particles have zero size
            }
        }
        if (grapeGeometry && grapeGeometry.attributes) {
          if(grapeGeometry.attributes.position) (grapeGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          if(grapeGeometry.attributes.color) (grapeGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
          if(grapeGeometry.attributes.size) (grapeGeometry.attributes.size as THREE.BufferAttribute).needsUpdate = true; 
        }
        if(grapeMaterial) {
          grapeMaterial.size = 1.0; // Base size for PointsMaterial if not using shader-based size. If shader uses 'size' attribute, this is a factor.
          grapeMaterial.needsUpdate = true;
        }
      }

      // Procedural Vines (data updated here, drawn on overlay canvas by VisualizerView)
      if (vinesData && canvasWidth > 0 && canvasHeight > 0) { // Ensure canvas dimensions are valid
        const { activeVines, spawnCooldown, maxVines } = vinesData;
        if (audioData.midEnergy > 0.35 && currentTime - (vinesData.lastSpawnTime || 0) > spawnCooldown && activeVines.length < maxVines) {
          vinesData.lastSpawnTime = currentTime;
          vinesData.nextVineId = (vinesData.nextVineId || 0) + 1;
          const newVine: ProceduralVine = {
            id: vinesData.nextVineId,
            points: [],
            color: `hsla(${(SBNF_HUES_SCENE.lightLavender + Math.random() * 60 - 30 + hueTimeShift)%360}, 70%, 65%, 0.7)`,
            opacity: 0.7,
            currentLength: 0,
            maxLength: 150 + Math.random() * 150, // pixels
            spawnTime: currentTime,
            lifetime: 2000 + Math.random() * 2000, // ms
            thickness: 1 + audioData.midEnergy * 2,
            curlFactor: 0.03 + Math.random() * 0.04,
            angle: Math.random() * Math.PI * 2,
            startX: Math.random() < 0.5 ? (Math.random() < 0.5 ? 5 : canvasWidth - 5) : Math.random() * canvasWidth, // Start near edges
            startY: Math.random() < 0.5 ? (Math.random() < 0.5 ? 5 : canvasHeight - 5) : Math.random() * canvasHeight, // Start near edges
            speed: 0.5 + audioData.midEnergy * 1.0,
          };
          newVine.points.push({ x: newVine.startX, y: newVine.startY });
          activeVines.push(newVine);
        }

        for (let i = activeVines.length - 1; i >= 0; i--) {
          const vine = activeVines[i];
          const age = currentTime - vine.spawnTime;
          if (age > vine.lifetime) {
            activeVines.splice(i, 1);
            continue;
          }
          vine.opacity = Math.max(0, 0.7 * (1 - age / vine.lifetime));
          vine.thickness = Math.max(0.5, (1 + audioData.midEnergy * 2) * (1 - age / vine.lifetime));


          if (vine.currentLength < vine.maxLength && vine.points.length > 0) {
            const lastPoint = vine.points[vine.points.length - 1];
            // More pronounced curl with treble, softer curl otherwise
            const curlInfluence = 0.05 + audioData.trebleEnergy * 0.2;
            const noiseAngle = (Math.sin(currentTime * 0.0005 * vine.curlFactor + vine.id + vine.points.length * 0.1)) * Math.PI * curlInfluence;
            vine.angle += noiseAngle * (deltaTime * 50); 

            const segmentLength = vine.speed * 1.5 * (1 + audioData.rms * 0.5); // Speed up with RMS
            let nextX = lastPoint.x + Math.cos(vine.angle) * segmentLength;
            let nextY = lastPoint.y + Math.sin(vine.angle) * segmentLength;
            
            // Boundary reflection/redirection
            if (nextX <= 0 || nextX >= canvasWidth) {
                vine.angle = Math.PI - vine.angle + (Math.random() - 0.5) * 0.5; // Reflect horizontally
                nextX = Math.max(1, Math.min(canvasWidth - 1, nextX)); // Keep within bounds
            }
            if (nextY <= 0 || nextY >= canvasHeight) {
                vine.angle = -vine.angle + (Math.random() - 0.5) * 0.5; // Reflect vertically
                nextY = Math.max(1, Math.min(canvasHeight - 1, nextY)); // Keep within bounds
            }

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
  // ... other scenes
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes&font=poppins', // SBNF Orange-Red
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
      triangleGeom.center(); // Center the geometry

      return {
        scene, camera,
        geometries: [circleGeom, squareGeom, triangleGeom],
        activeShapes: [], lastSpawnTime: 0,
        spawnInterval: 100, // ms, will be adjusted by audio
        shapeBaseLifetime: 2500, // ms
        lastFrameTime: performance.now(),
        tempColor: new THREE.Color(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black)
      } as WebGLSceneAssets & { 
        geometries: THREE.BufferGeometry[], 
        activeShapes: Array<{
          mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
          spawnTime: number;
          lifetime: number;
          initialScale: number;
          rotationSpeed: number;
          growInDuration: number;
        }>, 
        lastSpawnTime: number, 
        spawnInterval: number, 
        shapeBaseLifetime: number, 
        lastFrameTime: number, 
        tempColor: THREE.Color,
        bgColor: THREE.Color
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.geometries || !webGLAssets.activeShapes || !webGLAssets.bgColor || !webGLAssets.tempColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
      
      const { geometries, activeShapes, shapeBaseLifetime, bgColor, tempColor } = webGLAssets as any;
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime); // Milliseconds
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearAlpha(0.05); // For trail effect
      renderer.setClearColor((bgColor as THREE.Color).getHex(), renderer.getClearAlpha());
      
      const currentSpawnIntervalSetting = (webGLAssets as any).spawnInterval;
      const effectiveSpawnInterval = Math.max(50, currentSpawnIntervalSetting / (1 + audioData.rms * 2 + (audioData.beat ? 2 : 0))); // Faster spawn on beat/high RMS
      const spawnCondition = audioData.beat || (audioData.rms > 0.02 && currentTime - (webGLAssets as any).lastSpawnTime > effectiveSpawnInterval);

      if (spawnCondition && activeShapes.length < 50) { // Max 50 shapes
        (webGLAssets as any).lastSpawnTime = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 1.0 + audioData.bassEnergy * 0.5 + (audioData.beat ? 2 : 0)); // Spawn more on beat

        for (let k = 0; k < numToSpawn && activeShapes.length < 50; k++) {
          const geom = geometries[Math.floor(Math.random() * geometries.length)];
          const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geom, material);
          
          const sizeBase = (15 + audioData.bassEnergy * 80 + Math.random() * 30); // Base size in pixels
          const initialScale = sizeBase * Math.max(0.1, settings.brightCap) * (0.3 + audioData.midEnergy * 0.5);
          if (initialScale < 5) continue; // Skip if too small

          mesh.position.set(
            (Math.random() - 0.5) * canvasWidth * 0.85, 
            (Math.random() - 0.5) * canvasHeight * 0.85, 
            0
          );
          mesh.scale.set(initialScale * 0.1, initialScale * 0.1, 1); // Initial scale for pop-in

          const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];
          const baseObjectHue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
          const spectrumVal = (audioData.spectrum[k*5 % audioData.spectrum.length] || 0) / 255; // Use different parts of spectrum
          const hue = (baseObjectHue + spectrumVal * 40 + (audioData.beat ? 30:0) + performance.now()/400) % 360; // Time-based shift
          const [r,g,bVal] = hslToRgb(hue, 85 + Math.random()*15, 50 + Math.random()*20);
          material.color.setRGB(r,g,bVal);
          
          const lifetime = shapeBaseLifetime * (0.6 + Math.random() * 0.6); // Randomize lifetime
          const growInDuration = 250 + Math.random() * 100;
          activeShapes.push({ mesh, spawnTime: currentTime, lifetime, initialScale, rotationSpeed: (Math.random() - 0.5) * 0.0025 * (1 + audioData.trebleEnergy), growInDuration });
          scene.add(mesh);
        }
      }

      // Animate existing shapes
      for (let i = activeShapes.length - 1; i >= 0; i--) {
        const shape = activeShapes[i];
        const age = currentTime - shape.spawnTime;
        if (age > shape.lifetime) {
          scene.remove(shape.mesh); 
          shape.mesh.material.dispose(); 
          activeShapes.splice(i, 1); 
          continue;
        }

        const lifeProgress = age / shape.lifetime;
        const growInPhase = Math.min(1.0, age / shape.growInDuration);
        
        // Scale animation: Grow-in, then subtle pulse
        let currentScaleFactor = growInPhase; 
        if (age > shape.growInDuration) { 
            currentScaleFactor = 1 + Math.sin((age - shape.growInDuration) * 0.002 * (1 + audioData.midEnergy * 1.2)) * 0.15;
        }
        
        const finalScale = shape.initialScale * currentScaleFactor;
        shape.mesh.scale.set(finalScale, finalScale, finalScale);
        
        const targetOpacity = (0.25 + audioData.trebleEnergy * 0.35 + audioData.rms * 0.35) * settings.brightCap * 1.0;
        shape.mesh.material.opacity = Math.min(1, Math.max(0, (1.0 - lifeProgress) * targetOpacity * growInPhase));
        
        shape.mesh.rotation.z += shape.rotationSpeed * deltaTime * 0.06; // deltaTime adjustment for smoother rotation
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.activeShapes) {
          (webGLAssets.activeShapes as any[]).forEach(shape => { 
            if (webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(shape.mesh); 
            if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose(); 
          });
          (webGLAssets as any).activeShapes = [];
        }
        if (webGLAssets.geometries) { 
          (webGLAssets.geometries as THREE.BufferGeometry[]).forEach(geom => geom.dispose()); 
        }
      }
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings&font=poppins', // SBNF Orange-Yellow
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1; // Position camera for orthographic view
        
        const ringGeometry = new THREE.RingGeometry(0.98, 1, 64); // Shared geometry: outer radius 1, inner 0.98, 64 segments

        return {
            scene, camera, activeRings: [], ringGeometry,
            lastSpawnTimes: [0,0,0], // For bass, mid, treble respectively
            tempColor: new THREE.Color(),
            bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
            lastFrameTime: performance.now(),
        } as WebGLSceneAssets & { 
          activeRings: Array<{mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>, spawnTime: number, lifetime: number, maxRadius: number}>, 
          ringGeometry: THREE.RingGeometry, 
          lastSpawnTimes: number[], 
          tempColor: THREE.Color,
          bgColor: THREE.Color,
          lastFrameTime: number 
        };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.ringGeometry || !webGLAssets.activeRings || !webGLAssets.lastSpawnTimes || !webGLAssets.tempColor || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
        
        const { ringGeometry, activeRings, lastSpawnTimes, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime); // ms
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearAlpha(0.08); // Low alpha for trails
        renderer.setClearColor((bgColor as THREE.Color).getHex(), renderer.getClearAlpha());

        const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
        const baseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
        const spawnIntervals = [120, 100, 80]; // ms
        const maxRingRadius = Math.min(canvasWidth, canvasHeight) * 0.45; // Rings expand to 45% of min dimension

        energies.forEach((energy, i) => {
            const effectiveEnergy = Math.max(0.02, energy); // Avoid division by zero or too slow spawns
            if (energy > 0.04 && currentTime - lastSpawnTimes[i] > spawnIntervals[i] / (effectiveEnergy * 5 + 0.2)) {
                lastSpawnTimes[i] = currentTime;
                const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, opacity: 0 });
                const ringMesh = new THREE.Mesh(ringGeometry, material);
                
                const spectrumVal = (audioData.spectrum[i * 10 % audioData.spectrum.length] || 0) / 255; // Sample spectrum
                const hue = (baseHues[i] + spectrumVal * 40 + (audioData.beat ? 25 : 0) + performance.now()/500) % 360;
                const [r,g,bVal] = hslToRgb(hue, 90 + energy*10, 50 + energy*20);
                tempColor.setRGB(r,g,bVal);
                material.color.copy(tempColor);
                
                activeRings.push({ 
                  mesh: ringMesh, 
                  spawnTime: currentTime, 
                  lifetime: 1000 + energy * 1000, // ms
                  maxRadius: maxRingRadius * (0.25 + energy * 0.75) // Radius depends on energy
                });
                scene.add(ringMesh);
            }
        });

        // Animate existing rings
        for (let i = activeRings.length - 1; i >= 0; i--) {
            const ring = activeRings[i];
            const age = currentTime - ring.spawnTime;
            if (age > ring.lifetime) {
                scene.remove(ring.mesh); 
                ring.mesh.material.dispose(); // Dispose material when ring is done
                activeRings.splice(i, 1); 
                continue;
            }
            const lifeProgress = age / ring.lifetime;
            const currentRadius = lifeProgress * ring.maxRadius;
            if (currentRadius < 1) continue; // Don't draw tiny rings
            
            ring.mesh.scale.set(currentRadius, currentRadius, 1); // Scale the unit ring
            
            const opacityFade = Math.sin(Math.PI * (1.0 - lifeProgress)); // Fade in then out
            const alpha = opacityFade * (0.4 + audioData.rms * 0.5) * settings.brightCap * 1.1;
            ring.mesh.material.opacity = Math.min(0.85, Math.max(0, alpha)); // Clamp opacity
        }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.activeRings) {
          (webGLAssets.activeRings as any[]).forEach(ring => { 
            if (webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(ring.mesh); 
            if (ring.mesh.material) (ring.mesh.material as THREE.Material).dispose(); 
          });
          (webGLAssets as any).activeRings = [];
        }
        if (webGLAssets.ringGeometry) (webGLAssets.ringGeometry as THREE.RingGeometry).dispose(); // Dispose shared geometry
      }
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins', // SBNF Lavender
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;

        const GRID_SIZE_X = 16; 
        const GRID_SIZE_Y = Math.floor(GRID_SIZE_X * (canvas.height / canvas.width)); // Keep aspect ratio
        const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

        const cellGeom = new THREE.PlaneGeometry(1, 1); // Unit plane
        const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: false }); // Will use instanceColor
        const instancedMesh = new THREE.InstancedMesh(cellGeom, cellMaterial, totalCells);
        scene.add(instancedMesh);

        const cellWidth = canvas.width / GRID_SIZE_X;
        const cellHeight = canvas.height / GRID_SIZE_Y;
        const dummy = new THREE.Object3D(); // Used to set matrix for each instance
        const initialColor = new THREE.Color(SBNF_HUES_SCENE.black); // Start dark
        const cellStates: { currentColor: THREE.Color, targetColor: THREE.Color, lastUpdateTime: number, currentScale: number }[] = [];

        for (let j_idx = 0; j_idx < GRID_SIZE_Y; j_idx++) {
            for (let i_idx = 0; i_idx < GRID_SIZE_X; i_idx++) {
                const index = j_idx * GRID_SIZE_X + i_idx;
                dummy.position.set(
                    (i_idx - GRID_SIZE_X / 2 + 0.5) * cellWidth,
                    (j_idx - GRID_SIZE_Y / 2 + 0.5) * cellHeight,
                    0
                );
                dummy.scale.set(cellWidth * 0.9, cellHeight * 0.9, 1); // 90% of cell size for gaps
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
                instancedMesh.setColorAt(index, initialColor);
                cellStates.push({ currentColor: new THREE.Color().copy(initialColor), targetColor: new THREE.Color().copy(initialColor), lastUpdateTime: 0, currentScale: 0.9 });
            }
        }
        if (instancedMesh.instanceMatrix) instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        
        return {
            scene, camera, instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellWidth, cellHeight, cellStates,
            dummy: new THREE.Object3D(), // Re-declare dummy for this closure context if needed, or ensure it's part of webGLAssets
            tempColor: new THREE.Color(),
            lastFrameTime: performance.now(),
            bgColor: new THREE.Color(SBNF_HUES_SCENE.black),
        } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, GRID_SIZE_X: number, GRID_SIZE_Y: number, totalCells: number, cellWidth: number, cellHeight: number, cellStates: any[], dummy: THREE.Object3D, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.cellStates || !webGLAssets.dummy || !webGLAssets.tempColor || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
        
        const { instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellWidth, cellHeight, cellStates, dummy, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        // const deltaTime = (currentTime - webGLAssets.lastFrameTime); // Not strictly needed if lerping color
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearColor((bgColor as THREE.Color).getHex(), 1); // Solid black background

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;
        const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

        for (let j = 0; j < GRID_SIZE_Y; j++) {
            for (let i = 0; i < GRID_SIZE_X; i++) {
                const index = j * GRID_SIZE_X + i;
                if (index >= totalCells) continue; // Should not happen if GRID_SIZE_Y is calculated correctly

                // Map cell index to spectrum band (can be more sophisticated)
                const spectrumIndex = Math.floor((index / totalCells) * spectrumLength) % spectrumLength;
                const energy = (spectrum[spectrumIndex] || 0) / 255; // Normalize energy 0-1
                const cellState = cellStates[index];
                const beatFactor = audioData.beat ? 1.3 : 1.0; // Extra emphasis on beat
                
                // Target color based on audio energy and SBNF palette
                const targetLightness = 0.2 + energy * 0.5 * beatFactor * settings.brightCap; // Max 70% lightness, affected by brightCap
                const targetSaturation = 0.75 + energy * 0.25; // More saturated with more energy
                const baseHue = sbnfHues[(i + j + Math.floor(currentTime / 2000)) % sbnfHues.length]; // Slowly cycle base hue per cell
                const hue = (baseHue + energy * 30 + (audioData.beat ? 20 : 0)) % 360;

                const [r,g,bVal] = hslToRgb(hue, Math.min(100, targetSaturation*100), Math.min(80, targetLightness*100)); // Clamp saturation/lightness
                cellState.targetColor.setRGB(r,g,bVal);
                cellState.currentColor.lerp(cellState.targetColor, 0.12); // Smooth color transition
                instancedMesh.setColorAt(index, cellState.currentColor);

                // Scale animation (pulse)
                const baseScaleFactor = 0.9; // 90% of cell size
                const scalePulse = 1.0 + energy * 0.10 * beatFactor * audioData.rms; // Pulse with energy and RMS
                const targetScale = baseScaleFactor * scalePulse;
                cellState.currentScale = cellState.currentScale * 0.9 + targetScale * 0.1; // Smooth scale transition
                
                // Update matrix for scale (position is static for this grid)
                instancedMesh.getMatrixAt(index, dummy.matrix); // Get current matrix
                const currentPosition = new THREE.Vector3().setFromMatrixPosition(dummy.matrix); // Extract position
                dummy.scale.set(cellWidth * cellState.currentScale, cellHeight * cellState.currentScale, 1);
                dummy.position.copy(currentPosition); // Re-apply original position
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
            }
        }
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        if (instancedMesh.instanceMatrix) instancedMesh.instanceMatrix.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets && webGLAssets.instancedMesh) {
            if ((webGLAssets.instancedMesh as THREE.InstancedMesh).geometry) (webGLAssets.instancedMesh as THREE.InstancedMesh).geometry.dispose();
            if ((webGLAssets.instancedMesh as THREE.InstancedMesh).material) ((webGLAssets.instancedMesh as THREE.InstancedMesh).material as THREE.Material | THREE.Material[]).dispose();
        }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins', // SBNF Deep Purple
    dataAiHint: 'audio spectrum analysis',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const numBars = Math.floor((settings.fftSize / 2) * 0.7); // Use about 70% of available bins
      const barWidthRatio = 0.75; // Bar takes 75% of its allotted space, rest is gap
      const effectiveTotalWidth = canvas.width * 0.95; // Use 95% of canvas width for bars
      const barPlusGapWidth = effectiveTotalWidth / numBars;
      const barActualWidth = barPlusGapWidth * barWidthRatio;

      // Single plane geometry, will be instanced
      const barGeometry = new THREE.PlaneGeometry(barActualWidth, 1); // Height will be set by scale
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: false }); // Use instanceColor
      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      const dummy = new THREE.Object3D(); // For matrix updates
      const initialColor = new THREE.Color(SBNF_HUES_SCENE.deepPurple); // Start with a dark SBNF color

      for (let i = 0; i < numBars; i++) {
        const xPosition = (i - (numBars - 1) / 2) * barPlusGapWidth; // Center the group of bars
        dummy.position.set(xPosition, -canvas.height / 2 + 0.5, 0); // Initial position at bottom, height 1
        dummy.scale.set(1, 1, 1); // Initial scale
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, initialColor);
      }
      scene.add(instancedMesh);

      return {
        scene, camera, instancedMesh, numBars, barWidth: barPlusGapWidth, barActualWidth,
        dummy: new THREE.Object3D(), // Ensure dummy is part of returned assets for drawWebGL closure
        color: new THREE.Color(),   // Reusable color object
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // SBNF Black background
      } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, numBars: number, barWidth: number, barActualWidth: number, dummy: THREE.Object3D, color: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.dummy || !webGLAssets.color || !webGLAssets.bgColor) return;
      const { instancedMesh, numBars, barWidth, barActualWidth, dummy, color, bgColor } = webGLAssets as any;

      renderer.setClearColor((bgColor as THREE.Color).getHex(), 1); // Solid black background

      const spectrum = audioData.spectrum;
      const effectiveBrightCap = Math.max(0.05, settings.brightCap); // Ensure brightCap isn't zero
      const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];
      
      const spectrumSumForSilenceCheck = spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (numBars * 0.5); // If average bin value is < 0.5

      for (let i = 0; i < numBars; i++) {
        if (i >= spectrum.length) continue; // Should not happen if numBars is based on spectrum.length
        
        const normalizedValue = isAudioSilent ? 0.001 : (spectrum[i] || 0) / 255; // Ensure a tiny value even if silent
        const barHeightBase = normalizedValue * canvasHeight * effectiveBrightCap * 1.1; // Base height on spectrum, canvas, and brightCap
        // Add pulse with RMS and beat
        const barHeight = Math.max(1, barHeightBase * (0.4 + audioData.rms * 0.6 + (audioData.beat ? 0.15 : 0)));
        
        dummy.scale.set(1, barHeight, 1); // Scale Y for height, X is from barActualWidth in geometry
        
        const xPosition = (i - (numBars - 1) / 2) * barWidth; // Centered position
        dummy.position.set(xPosition, barHeight / 2 - canvasHeight / 2, 0); // Position bar to grow from bottom
        
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        // Color logic based on SBNF palette and audio
        const hueIndex = Math.floor((i / numBars) * sbnfHues.length); // Cycle through SBNF hues
        const baseHue = sbnfHues[hueIndex % sbnfHues.length];
        const specVal = (audioData.spectrum[i] || 0) / 255; // Normalized spectrum value for this bar
        const hue = (baseHue + specVal * 30 + (audioData.beat ? 20 : 0) + performance.now() / 250) % 360; // Time-based shift + audio reaction
        const saturation = 70 + specVal * 30; // More saturated for louder bins
        const lightness = 40 + specVal * 35 + (audioData.beat ? 10 : 0); // Brighter for louder/beat
        
        const [r,g,bVal] = hslToRgb(hue, Math.min(100, saturation), Math.min(75, lightness)); // Clamp saturation/lightness
        color.setRGB(r, g, bVal);
        instancedMesh.setColorAt(i, color);
      }
      if (instancedMesh.instanceMatrix) instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets && webGLAssets.instancedMesh) {
        if ((webGLAssets.instancedMesh as THREE.InstancedMesh).geometry) (webGLAssets.instancedMesh as THREE.InstancedMesh).geometry.dispose();
        if ((webGLAssets.instancedMesh as THREE.InstancedMesh).material) ((webGLAssets.instancedMesh as THREE.InstancedMesh).material as THREE.Material | THREE.Material[]).dispose();
      }
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins', // SBNF Orange-Red
    dataAiHint: 'abstract explosion particles',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 200; // Camera further back for perspective

      const PARTICLE_COUNT = 4000; // Reduced from 5000
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); // For storing direction and speed
      const lifetimes = new Float32Array(PARTICLE_COUNT); // Remaining life of each particle
      const spawnTimes = new Float32Array(PARTICLE_COUNT); // Not strictly needed if using lifetimes directly

      // Initialize particles as "dead" (lifetime 0) and off-screen or at origin
      for (let i = 0; i < PARTICLE_COUNT; i++) {
          lifetimes[i] = 0; // Mark as dead
          const pIdx = i * 3;
          positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const material = new THREE.PointsMaterial({ 
        size: 2.0, 
        vertexColors: true, 
        transparent: true, 
        blending: THREE.AdditiveBlending, 
        depthWrite: false, // Good for additive blending
        sizeAttenuation: true 
      });
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      return {
        scene, camera, particles, material, geometry, positions, colors, velocities, lifetimes, spawnTimes,
        PARTICLE_COUNT, lastBeatSpawnTime: 0, lastAmbientSpawnTime: 0, tempColor: new THREE.Color(),
        lastFrameTime: performance.now(), bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // SBNF Black background
      } as WebGLSceneAssets & { particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; spawnTimes: Float32Array; PARTICLE_COUNT: number; lastBeatSpawnTime: number; lastAmbientSpawnTime: number; tempColor: THREE.Color; lastFrameTime: number; bgColor: THREE.Color; };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
        
        const { particles, material, geometry, positions, colors, velocities, lifetimes, spawnTimes, PARTICLE_COUNT, tempColor, bgColor } = webGLAssets as any;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // Delta time in seconds
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearAlpha(0.06); // Low alpha for motion trails
        renderer.setClearColor((bgColor as THREE.Color).getHex(), renderer.getClearAlpha());

        const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
        const sbnfHuesAmbient = [SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue]; // Using tronBlue for ambient
        
        // Beat-triggered burst
        const beatCooldown = 100; // ms
        if (audioData.beat && (currentTime - (webGLAssets.lastBeatSpawnTime || 0) > beatCooldown)) {
            webGLAssets.lastBeatSpawnTime = currentTime;
            let burstParticlesToSpawn = Math.floor(PARTICLE_COUNT * (0.08 + audioData.bassEnergy * 0.25)); // Reduced multiplier
            burstParticlesToSpawn = Math.min(burstParticlesToSpawn, Math.floor(PARTICLE_COUNT * 0.12)); // Cap burst size
            let spawnedThisBeat = 0;

            for (let i = 0; i < PARTICLE_COUNT && spawnedThisBeat < burstParticlesToSpawn; i++) {
                if (lifetimes[i] <= 0) { // Find a "dead" particle
                    const pIdx = i * 3;
                    positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0; // Spawn at origin
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1.0); // Uniform spherical distribution
                    const speed = 100 + Math.random() * 150 + audioData.bassEnergy * 200 + audioData.rms * 100;
                    
                    velocities[pIdx]     = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);
                    
                    const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
                    const [r, g, bVal] = hslToRgb(hue, 100, 50 + Math.random() * 20); // Bright SBNF colors
                    tempColor.setRGB(r, g, bVal);
                    colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;
                    
                    lifetimes[i] = 0.7 + Math.random() * 1.0; // seconds
                    spawnTimes[i] = currentTime; // Store spawn time for age calculation
                    spawnedThisBeat++;
                }
            }
        }

        // Ambient particle spawning (continuous but less intense)
        const ambientSpawnRate = 30 + audioData.rms * 80; // Particles per second
        const ambientSpawnInterval = 1000 / Math.max(1, ambientSpawnRate); // Interval in ms
        if (currentTime - (webGLAssets.lastAmbientSpawnTime || 0) > ambientSpawnInterval) {
            webGLAssets.lastAmbientSpawnTime = currentTime;
            let spawnedAmbient = 0;
            const maxAmbientSpawn = Math.floor(PARTICLE_COUNT * 0.03); // Reduced cap for ambient

            for (let i = 0; i < PARTICLE_COUNT && spawnedAmbient < maxAmbientSpawn; i++) { 
                if (lifetimes[i] <= 0) { // Find a "dead" particle
                    const pIdx = i * 3;
                    positions[pIdx] = 0; positions[pIdx + 1] = 0; positions[pIdx + 2] = 0;
                    
                    const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1.0);
                    const speed = 20 + Math.random() * 30 + audioData.midEnergy * 50; // Slower speeds for ambient
                    
                    velocities[pIdx]     = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);
                    
                    const hue = sbnfHuesAmbient[Math.floor(Math.random() * sbnfHuesAmbient.length)];
                    const [r, g, bVal] = hslToRgb(hue, 70 + Math.random() * 30, 40 + Math.random() * 20); // Cooler SBNF colors
                    tempColor.setRGB(r, g, bVal);
                    colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;
                    
                    lifetimes[i] = 1.5 + Math.random() * 1.5; // Longer lifetime for ambient
                    spawnTimes[i] = currentTime;
                    spawnedAmbient++;
                }
            }
        }
        
        // Update all live particles
        const dragFactor = 0.98; // Simulate air resistance
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (lifetimes[i] > 0) { 
                const pIdx = i * 3;
                // const age = (currentTime - spawnTimes[i]); // Age in ms
                const initialLifetimeMs = (lifetimes[i] / deltaTime) * 16.67 + (currentTime - spawnTimes[i]); // Estimate initial lifetime

                lifetimes[i] -= deltaTime; // Decrease lifetime

                if (lifetimes[i] <= 0) { 
                    positions[pIdx] = 100000; // Move dead particles far away (or set alpha to 0 in shader)
                    velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0; // Stop movement
                    colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0; // Make black/invisible
                    continue; 
                }
                
                // Apply drag
                velocities[pIdx] *= dragFactor; velocities[pIdx + 1] *= dragFactor; velocities[pIdx + 2] *= dragFactor;
                // Update position
                positions[pIdx]     += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

                // Fade color (alpha) over lifetime
                // For PointsMaterial, we modulate the RGB values directly to fade to black.
                const lifeRatio = Math.max(0, (lifetimes[i]*1000) / (initialLifetimeMs + 0.01)); // Normalized remaining life (0-1)
                const fadeFactor = lifeRatio * 0.96 + 0.04; // Ensure particles are slightly visible even at end of life
                colors[pIdx] *= fadeFactor; colors[pIdx+1] *= fadeFactor; colors[pIdx+2] *= fadeFactor;
            }
        }

        if(geometry.attributes.position) (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        if(geometry.attributes.color) (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        
        material.size = (1.8 + audioData.rms * 3.5) * Math.max(0.1, settings.brightCap); // Global size modulation
        material.opacity = Math.max(0.1, settings.brightCap * (0.35 + audioData.rms * 0.40)); // Global opacity modulation
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) { 
            if (webGLAssets.geometry) (webGLAssets.geometry as THREE.BufferGeometry).dispose(); 
            if (webGLAssets.material) (webGLAssets.material as THREE.PointsMaterial).dispose(); 
            // Particles (THREE.Points object) are automatically removed from scene if scene is disposed.
        }
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FF441A.png?text=Tunnel&font=poppins', // SBNF Deep Purple
    dataAiHint: 'geometric tunnel flight tron',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      // Perspective camera for a tunnel effect
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 50; // Start camera inside the first few segments

      const numSegments = 20;
      const segmentDepth = 100; // How "deep" each segment is along Z
      const segmentRadius = 100; // Radius of the tunnel
      // Using TorusGeometry for thicker rings, giving a more substantial Tron feel
      const segmentGeometry = new THREE.TorusGeometry(segmentRadius, 2.0, 10, 40); // radius, tubeRadius, radialSegments, tubularSegments
      const segments: THREE.Mesh[] = [];

      for (let i = 0; i < numSegments; i++) {
        const material = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.6 });
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * segmentDepth; // Position segments along Z axis
        segment.rotation.x = Math.PI / 2; // Rotate tori to form a tunnel
        scene.add(segment);
        segments.push(segment);
      }

      return {
        scene, camera, segments, numSegments, segmentDepth, segmentSpeed: 120, // Base speed units/sec
        cameraBaseFov: 75, // Store base FOV for dynamic adjustments
        tempColor: new THREE.Color(),
        lastFrameTime: performance.now(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // SBNF Black background for Tron
      } as WebGLSceneAssets & { segments: THREE.Mesh[], numSegments: number, segmentDepth: number, segmentSpeed: number, cameraBaseFov: number, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.segments || !(camera instanceof THREE.PerspectiveCamera) || !webGLAssets.cameraBaseFov || !webGLAssets.tempColor || typeof webGLAssets.lastFrameTime === 'undefined' || !webGLAssets.bgColor) return;
        const { segments, segmentDepth, numSegments, segmentSpeed, cameraBaseFov, tempColor, bgColor } = webGLAssets as any;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // Delta time in seconds
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearColor((bgColor as THREE.Color).getHex(), 1); // Solid SBNF Black

        segments.forEach((segment: THREE.Mesh, i: number) => {
            // Move segment towards camera; recycle if it passes
            segment.position.z += segmentSpeed * (1 + audioData.rms * 1.0 + (audioData.beat ? 0.3 : 0)) * deltaTime; // Speed up with audio
            if (segment.position.z > camera.position.z + segmentDepth / 2) { // If segment is behind camera start + half its depth
                segment.position.z -= numSegments * segmentDepth; // Move it to the far end of the tunnel
            }

            // Tron-like colors: Cyan/Blue primary, with Orange/Red highlights on beat or high energy
            const hueOptions = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.lightLavender]; // Tron blues and SBNF lavender
            let baseHue = hueOptions[(i + Math.floor(currentTime * 0.0002)) % hueOptions.length]; // Slow cycle through base hues
            
            const audioInfluence = audioData.rms * 40 + ((audioData.spectrum[i % audioData.spectrum.length] || 0) / 255) * 30;
            let targetHue = (baseHue + audioInfluence) % 360;
            let saturation = 80 + Math.random()*20;
            let lightness = 0.3 + audioData.rms * 0.2 + settings.brightCap * 0.1;

            if(audioData.beat && i % 3 === 0) { // Highlight some segments on beat
                targetHue = (SBNF_HUES_SCENE.orangeRed + Math.random() * 20 - 10) % 360;
                saturation = 100;
                lightness = 0.5 + Math.random() * 0.1;
            }
            
            const [r, g, bVal] = hslToRgb(targetHue, saturation, Math.min(0.7, lightness) * 100);
            tempColor.setRGB(r, g, bVal);
            if (segment.material instanceof THREE.MeshBasicMaterial) {
                segment.material.color.lerp(tempColor, 0.1); // Smooth color transition
                segment.material.opacity = Math.min(0.7, 0.4 + audioData.rms * 0.3 + settings.brightCap * 0.1);
            }

            // Segment rotation
            segment.rotation.z += (audioData.trebleEnergy * 0.025 + 0.001 + audioData.bpm * 0.00002) * (i % 2 === 0 ? 1.2 : -1.4) * deltaTime * 60; // Different rotation per segment
            segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0006 + i * 0.35) * audioData.midEnergy * 0.6; // Wobble effect
        });

        // Camera FOV effect for speed/warping
        camera.fov = cameraBaseFov - audioData.rms * 35 * settings.gamma + (audioData.beat ? 8 : 0) ; // Zoom in/out with RMS/beat
        camera.fov = Math.max(50, Math.min(90, camera.fov)); // Clamp FOV
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
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins', // SBNF Cream
    dataAiHint: 'strobe light flash',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      // Orthographic camera for a full-screen effect
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); 
      
      // Full-screen quad
      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeMaterial = new THREE.MeshBasicMaterial({ 
        color: new THREE.Color(SBNF_HUES_SCENE.black), 
        transparent: true, 
        opacity: 1 // Start opaque black
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(planeMesh);

      return {
        scene, camera, planeMesh,  planeMaterial, tempColor: new THREE.Color(),
        bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // Background if plane is transparent
        lastFrameTime: performance.now(),
      } as WebGLSceneAssets & { planeMesh: THREE.Mesh, planeMaterial: THREE.MeshBasicMaterial, tempColor: THREE.Color, bgColor: THREE.Color, lastFrameTime: number };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.planeMesh || !webGLAssets.planeMaterial || !webGLAssets.tempColor || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
      const { planeMaterial, tempColor, bgColor } = webGLAssets as any;
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // Delta in seconds
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearColor((bgColor as THREE.Color).getHex(), 1.0); // Ensure renderer background is consistently black

      if (audioData.beat && settings.brightCap > 0.01) {
        // Flash with a random SBNF accent color
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
        const lightness = 70 + Math.random() * 25; // Bright flash
        
        const [r,g,bVal] = hslToRgb(hue, 100, lightness);
        tempColor.setRGB(r,g,bVal);
        planeMaterial.color.copy(tempColor);
        planeMaterial.opacity = Math.min(1, settings.brightCap * 1.0); // Flash opacity based on brightCap
      } else {
        // Fade out the flash quickly
        planeMaterial.opacity = Math.max(0, planeMaterial.opacity - deltaTime * 10.0); // Faster fade
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.planeMesh?.geometry) (webGLAssets.planeMesh.geometry as THREE.PlaneGeometry).dispose();
        if (webGLAssets.planeMaterial) (webGLAssets.planeMaterial as THREE.MeshBasicMaterial).dispose();
      }
    }
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale&font=poppins', // SBNF Orange-Yellow
    dataAiHint: 'cosmic explosion stars fireworks',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 300; // Start camera a bit further back

      const PARTICLE_COUNT = 3000; // Reduced from 3500
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); // For storing direction and speed
      const lifetimes = new Float32Array(PARTICLE_COUNT); // Remaining life of each particle
      const spawnTimes = new Float32Array(PARTICLE_COUNT); // When particle was last (re)spawned

      // Initialize all particles as "dead" (lifetime 0)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
          lifetimes[i] = 0;
          const pIdx = i * 3;
          positions[pIdx] = 100000; // Move off-screen initially
          colors[pIdx] = 0; colors[pIdx + 1] = 0; colors[pIdx + 2] = 0; // Black/invisible
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const material = new THREE.PointsMaterial({ 
        size: 1.6, // Slightly reduced base size
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
        lastFrameTime: performance.now(), bgColor: new THREE.Color(SBNF_HUES_SCENE.black), // SBNF Black background
        rotationSpeed: new THREE.Vector3(0.006, 0.008, 0.003), // Base rotation speeds
      } as WebGLSceneAssets & { particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; spawnTimes: Float32Array; PARTICLE_COUNT: number; lastBeatTime: number; tempColor: THREE.Color; lastFrameTime: number; bgColor: THREE.Color; rotationSpeed: THREE.Vector3; };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
        
        const { particles, material, geometry, positions, colors, velocities, lifetimes, spawnTimes, PARTICLE_COUNT, tempColor, bgColor, rotationSpeed } = webGLAssets as any;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; // Delta time in seconds
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearAlpha(0.07); // Keep trails, but slightly faster clear
        renderer.setClearColor((bgColor as THREE.Color).getHex(), renderer.getClearAlpha());

        const beatCooldown = 180; // ms, min time between bursts
        const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender];
        
        if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            let particlesToSpawn = Math.floor(PARTICLE_COUNT * (0.20 + audioData.bassEnergy * 0.10 + audioData.rms * 0.05)); // Spawn up to 20% + audio factors
            particlesToSpawn = Math.min(particlesToSpawn, Math.floor(PARTICLE_COUNT * 0.25)); // Cap at 25% of total particles
            let spawnedCount = 0;

            for (let i = 0; i < PARTICLE_COUNT && spawnedCount < particlesToSpawn; i++) {
                if (lifetimes[i] <= 0) { // Find a "dead" particle
                    const pIdx = i * 3;
                    // Spawn particles slightly off-center for more spread
                    positions[pIdx] = (Math.random() - 0.5) * 10; 
                    positions[pIdx + 1] = (Math.random() - 0.5) * 10;
                    positions[pIdx + 2] = (Math.random() - 0.5) * 10;
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1.0); // Uniform spherical distribution
                    const speed = 120 + Math.random() * 160 + audioData.bassEnergy * 180 + audioData.rms * 90;
                    
                    velocities[pIdx]     = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);
                    
                    const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
                    // Vary lightness more to avoid all-white
                    const baseLightness = 45 + Math.random() * 20; // Range 45-65
                    const lightnessVariation = (audioData.beat ? 10 : 0) + (audioData.rms * 15);
                    const finalLightness = Math.min(75, baseLightness + lightnessVariation); // Cap lightness at 75%
                    const [r,g,bVal] = hslToRgb(hue, 90 + Math.random() * 10, finalLightness); 
                    tempColor.setRGB(r,g,bVal);
                    colors[pIdx] = tempColor.r; colors[pIdx + 1] = tempColor.g; colors[pIdx + 2] = tempColor.b;
                    
                    lifetimes[i] = 1.4 + Math.random() * 0.8; // seconds
                    spawnTimes[i] = currentTime;
                    spawnedCount++;
                }
            }
        }
        
        // Update all live particles
        const dragFactor = 0.982; // Gentle drag
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (lifetimes[i] > 0) { 
                const pIdx = i * 3;
                const ageMs = (currentTime - spawnTimes[i]); 
                // Approx initial lifetime for more accurate lifeRatio. Add deltaTime to avoid div by zero if ageMs is very small.
                const approxInitialLifetimeMs = (lifetimes[i] / (deltaTime + 0.0001)) * 16.67 + ageMs; 

                lifetimes[i] -= deltaTime; // Decrease lifetime in seconds

                if (lifetimes[i] <= 0) { 
                    positions[pIdx] = 100000; // Move dead particles far away
                    velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0; // Stop movement
                    colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0; // Make black/invisible
                    continue; 
                }
                
                // Apply drag
                velocities[pIdx] *= dragFactor; velocities[pIdx + 1] *= dragFactor; velocities[pIdx + 2] *= dragFactor;
                // Update position
                positions[pIdx]     += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

                // Fade color (RGB values) over lifetime
                const lifeRatio = Math.max(0, (lifetimes[i]*1000) / (approxInitialLifetimeMs + 0.01)); // Normalized remaining life (0-1)
                const fadeFactor = Math.pow(lifeRatio, 0.5); // Easing for fade (sqrt makes it fade slower initially)
                colors[pIdx] *= fadeFactor; colors[pIdx+1] *= fadeFactor; colors[pIdx+2] *= fadeFactor;
            }
        }

        if(geometry.attributes.position) (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        if(geometry.attributes.color) (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        
        // Global material properties modulation
        material.size = (1.6 + audioData.rms * 2.5) * Math.max(0.1, settings.brightCap); // Modulate size with RMS and brightCap
        material.opacity = Math.max(0.1, settings.brightCap * (0.25 + audioData.rms * 0.45)); // Modulate opacity

        // Rotate the entire particle system
        if (particles && rotationSpeed) {
            particles.rotation.x += (rotationSpeed as THREE.Vector3).x * deltaTime * (0.1 + audioData.midEnergy * 0.4);
            particles.rotation.y += (rotationSpeed as THREE.Vector3).y * deltaTime * (0.1 + audioData.trebleEnergy * 0.4);
        }

        // Camera effects
        if(camera && camera instanceof THREE.PerspectiveCamera) {
            camera.fov = 75 + audioData.rms * 2; // More subtle FOV change
            camera.fov = Math.max(73, Math.min(77, camera.fov)); // Clamp FOV
            camera.updateProjectionMatrix();
            camera.position.z = 300 - audioData.rms * 20; // Less drastic zoom
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

// Utility function to draw vines - can be called from VisualizerView on the overlay canvas
export function drawProceduralVines(ctx: CanvasRenderingContext2D, vines: ProceduralVine[]) {
  if (!vines || vines.length === 0) return;

  vines.forEach(vine => {
    if (vine.points.length < 2 || vine.opacity <= 0.01) return;

    ctx.beginPath();
    ctx.moveTo(vine.points[0].x, vine.points[0].y);
    for (let i = 1; i < vine.points.length; i++) {
      ctx.lineTo(vine.points[i].x, vine.points[i].y);
    }
    ctx.strokeStyle = vine.color.replace(/[\d\.]+\)$/g, `${vine.opacity})`); // Update alpha in hsla/rgba
    ctx.lineWidth = Math.max(0.5, vine.thickness);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  });
}
