
/* eslint-disable react-hooks/exhaustive-deps */
// This top-level comment can be removed or updated if not needed for client components.
// 'use client'; // This directive is usually for components, not utility/constant files.

import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets, ProceduralVine } from '@/types';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

export const FFT_SIZES = [128, 256, 512] as const;

// SBNF Theme Colors (approximations, actual HSL values in globals.css)
export const SBNF_HUES_SCENE = {
  black: 0, // (Used for #000000)
  orangeRed: 13, // (#FF441A)
  orangeYellow: 36, // (#FDB143)
  lightPeach: 30, // (#FFECDA)
  lightLavender: 267, // (#E1CCFF)
  deepPurple: 258, // (#5A36BB)
  // Added Tron-like colors for variety in some scenes
  tronBlue: 197, // A bright cyan/blue
  tronPink: 337, // A magenta/pink
} as const;


// Helper to convert HSL to RGB components (0-1 range)
// Used by some scenes for direct color manipulation if needed.
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}


// Helper function to generate a simple noise texture for WebGL scenes
// Used by Mirror Silhouette for its nebula fill effect.
export function generateNoiseTexture(width: number, height: number): THREE.DataTexture {
  const size = width * height;
  const data = new Uint8Array(4 * size); // RGBA
  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    const x = (i % width) / width; // Normalized x
    const y = Math.floor(i / width) / height; // Normalized y

    // Simple multi-octave noise (could be Perlin or simplex for better quality)
    let v = 0;
    for (let o = 0; o < 4; o++) { // 4 octaves
      const freq = 2 ** o;
      const amp = 0.5 ** o;
      v += Math.sin(x * Math.PI * freq * 5 + Math.random() * 0.2) * amp;
      v += Math.cos(y * Math.PI * freq * 7 + Math.random() * 0.3) * amp;
    }
    v = (v / 1.5 + 1) / 2; // Normalize and bias

    const value = Math.floor(v * 180) + 75; // Output range for grayscale, biased towards brighter
    data[stride] = value;     // R
    data[stride + 1] = value; // G
    data[stride + 2] = value; // B
    data[stride + 3] = 255;   // A (fully opaque)
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}


export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1,
  enableAgc: true, // AGC is now functional
  gamma: 1,
  dither: 0,
  brightCap: 1,
  logoOpacity: 0.25, // Default SBNF logo opacity
  showWebcam: false, // Webcam off by default, user must enable
  mirrorWebcam: true, // Default to mirrored for performer convenience
  currentSceneId: 'radial_burst', // A visually active default
  panicMode: false,
  logoBlackout: false,
  logoAnimationSettings: {
    type: 'pulse', // Default logo animation
    speed: 1,
    color: '#FF441A', // SBNF Orange-Red, for solid/blink animations
  },
  lastAISuggestedAssetPrompt: undefined,
  sceneTransitionDuration: 500, // Default 500ms crossfade
  sceneTransitionActive: true,
  monitorAudio: false, // Audio monitoring off by default (feedback risk)
  selectedAudioInputDeviceId: undefined, // Use system default mic initially
  enableAiOverlay: false, // AI overlay off by default
  aiGeneratedOverlayUri: null,
  aiOverlayOpacity: 0.5,
  aiOverlayBlendMode: 'overlay',
  // SBNF Themed default prompt
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent",
  enablePeriodicAiOverlay: false, // Periodic AI overlay updates off by default
  aiOverlayRegenerationInterval: 45, // Default interval in seconds
};

export const INITIAL_AUDIO_DATA: AudioData = {
  spectrum: new Uint8Array(DEFAULT_SETTINGS.fftSize / 2).fill(0),
  bassEnergy: 0,
  midEnergy: 0,
  trebleEnergy: 0,
  rms: 0,
  bpm: 120, // A common starting BPM
  beat: false,
};

export const SCENES: SceneDefinition[] = [
  // Reordered based on typical energy/complexity progression
  {
    id: 'mirror_silhouette',
    name: 'Mirror Silhouette',
    displayLabel: 'MIRROR',
    rendererType: 'webgl',
    dataAiHint: 'webcam silhouette performer',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.deepPurple.toString(16)}/${SBNF_HUES_SCENE.lightPeach.toString(16)}.png`, // SBNF Deep Purple, Light Peach
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      // Orthographic camera is better for full-screen shader effects on a plane
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene,
        camera,
        lastCanvasWidth: 0,
        lastCanvasHeight: 0,
        noiseTexture: generateNoiseTexture(256, 256), // For nebula fill
        vinesData: { // For procedural vines
          activeVines: [] as ProceduralVine[],
          nextVineId: 0,
          lastSpawnTime: 0,
          spawnCooldown: 200, // ms
          maxVines: 15,
        },
        grapesData: { // For beat-spawn grape spheres
          activeGrapes: [],
          nextGrapeId: 0,
          lastGrapeSpawnTime: 0,
          spawnCooldown: 150, // ms
          maxGrapes: 50, // Max grapes visible at once
          grapeGeometry: new THREE.BufferGeometry(), // Will be populated with particle attributes
          grapeBaseMaterial: new THREE.PointsMaterial({
            size: 10, // Base size, will be modulated
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            depthWrite: false,
          }),
          GRAPE_PARTICLE_COUNT_PER_CLUSTER: 200, // Total particles for grapes
        }
      };

      if (webcamElement && webcamElement.readyState >= HTMLMediaElement.HAVE_METADATA && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0) {
        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.NearestFilter;
        videoTexture.magFilter = THREE.NearestFilter;
        videoTexture.generateMipmaps = false;

        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);
        // Fresnel + Noise Fill Shader
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
            resolution: { value: new THREE.Vector2(canvas.width, canvas.height) }
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
            uniform sampler2D noiseTexture;
            uniform float time;
            uniform vec3 rimColor;
            uniform vec3 fillColor1;
            uniform vec3 fillColor2;
            uniform float opacityFactor;
            uniform vec2 resolution;
            varying vec2 vUv;

            float fresnel(vec2 texCoord, float rimWidth) {
              vec2 centeredCoord = texCoord * 2.0 - 1.0; // -1 to 1
              float distFromEdge = 1.0 - length(centeredCoord);
              return smoothstep(0.0, rimWidth, distFromEdge);
            }

            float luma(vec3 color) {
              return dot(color, vec3(0.299, 0.587, 0.114));
            }

            void main() {
              // Performance: Checkerboard discard
              if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard;

              vec4 webcamColor = texture2D(webcamTexture, vUv);
              float webcamLuma = luma(webcamColor.rgb);
              // Softer silhouette, adjust thresholds for sensitivity
              float silhouetteAlpha = smoothstep(0.35, 0.65, webcamLuma) * webcamColor.a;

              // Fresnel for rim light, boost intensity
              float fresnelFactor = fresnel(vUv, 0.15); // Rim width, adjust as needed
              vec3 finalRimColor = rimColor * fresnelFactor * (1.0 + silhouetteAlpha * 1.5);

              // Scrolling noise for nebula fill
              vec2 scrolledNoiseUv = vUv + vec2(time * 0.02, time * 0.01);
              vec4 noiseColor = texture2D(noiseTexture, scrolledNoiseUv);
              vec3 nebulaFill = mix(fillColor1, fillColor2, noiseColor.r) * (0.5 + noiseColor.g * 0.5);

              vec3 blendedFill = mix(vec3(0.0), nebulaFill, silhouetteAlpha * 0.9); // Nebula inside silhouette

              vec3 finalColor = blendedFill + finalRimColor;
              float finalAlpha = opacityFactor * (silhouetteAlpha + fresnelFactor * 0.3) * 1.85; // Compensate for discard

              gl_FragColor = vec4(finalColor, clamp(finalAlpha, 0.0, 1.0));
              gl_FragColor.rgb *= gl_FragColor.a; // Premultiply alpha
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        webGLAssets.videoTexture = videoTexture;
        webGLAssets.planeMesh = planeMesh;
        webGLAssets.shaderMaterial = shaderMaterial;
      }

      // Initialize Grape Particles
      if (webGLAssets.grapesData?.grapeGeometry && webGLAssets.grapesData.grapeBaseMaterial) {
        const { GRAPE_PARTICLE_COUNT_PER_CLUSTER } = webGLAssets.grapesData;
        const positions = new Float32Array(GRAPE_PARTICLE_COUNT_PER_CLUSTER! * 3);
        const colors = new Float32Array(GRAPE_PARTICLE_COUNT_PER_CLUSTER! * 3);
        const sizes = new Float32Array(GRAPE_PARTICLE_COUNT_PER_CLUSTER!); // For varying particle sizes

        for (let i = 0; i < GRAPE_PARTICLE_COUNT_PER_CLUSTER!; i++) {
          positions[i * 3 + 0] = (Math.random() - 0.5) * canvas.width; // Spread out initially (off-screen or random)
          positions[i * 3 + 1] = (Math.random() - 0.5) * canvas.height;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 100; // Depth
        }
        webGLAssets.grapesData.grapeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        webGLAssets.grapesData.grapeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        webGLAssets.grapesData.grapeGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const grapeParticles = new THREE.Points(webGLAssets.grapesData.grapeGeometry, webGLAssets.grapesData.grapeBaseMaterial);
        scene.add(grapeParticles);
        webGLAssets.grapesData.mesh = grapeParticles; // Store the Points object
      }


      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight, webcamElement }) => {
      const currentTime = performance.now();
      const scene = webGLAssets.scene as THREE.Scene;
      const camera = webGLAssets.camera as THREE.OrthographicCamera;

      // Handle canvas resize for planeMesh
      if ((canvasWidth !== webGLAssets.lastCanvasWidth || canvasHeight !== webGLAssets.lastCanvasHeight) && webGLAssets.planeMesh) {
        webGLAssets.planeMesh.geometry.dispose();
        webGLAssets.planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
        webGLAssets.lastCanvasWidth = canvasWidth;
        webGLAssets.lastCanvasHeight = canvasHeight;
      }


      if (webGLAssets.shaderMaterial) {
        webGLAssets.shaderMaterial.uniforms.time.value = currentTime * 0.0005;
        webGLAssets.shaderMaterial.uniforms.opacityFactor.value = settings.brightCap * (0.5 + audioData.rms * 0.5);
        webGLAssets.shaderMaterial.uniforms.mirrorX_bool.value = settings.mirrorWebcam;
        webGLAssets.shaderMaterial.uniforms.resolution.value.set(canvasWidth, canvasHeight);

        const baseSBNFHue = SBNF_HUES_SCENE.deepPurple / 360; // SBNF Deep Purple
        const timeHueShift = Math.sin(currentTime * 0.0002) * 0.1;

        webGLAssets.shaderMaterial.uniforms.rimColor.value.setHSL(
          (SBNF_HUES_SCENE.lightLavender / 360 + timeHueShift + audioData.trebleEnergy * 0.1) % 1,
          0.8 + audioData.trebleEnergy * 0.2,
          0.6 + audioData.midEnergy * 0.15
        );
        webGLAssets.shaderMaterial.uniforms.fillColor1.value.setHSL(
          (baseSBNFHue + timeHueShift * 1.2 + audioData.bassEnergy * 0.05) % 1,
          0.7 + audioData.bassEnergy * 0.15,
          0.35 + audioData.rms * 0.2
        );
        webGLAssets.shaderMaterial.uniforms.fillColor2.value.setHSL(
          (SBNF_HUES_SCENE.tronBlue / 360 + timeHueShift * 0.8 - audioData.midEnergy * 0.05) % 1,
          0.75 + audioData.midEnergy * 0.2,
          0.4 + audioData.rms * 0.25
        );

        if (webGLAssets.videoTexture && webcamElement && webcamElement.readyState === webcamElement.HAVE_ENOUGH_DATA) {
          webGLAssets.videoTexture.needsUpdate = true;
        }
      } else {
         // Fallback if webcam/shader material didn't initialize: clear to SBNF Purple
        renderer.setClearColor(new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.47), 1);
        renderer.clear();
      }

      // Vine logic (from previous implementation, ensure it draws on overlay canvas)
      const vinesData = webGLAssets.vinesData;
      if (vinesData && vinesData.activeVines) { // Check if activeVines is defined
        const { activeVines, spawnCooldown, maxVines } = vinesData;
        if (audioData.midEnergy > 0.3 && (currentTime - vinesData.lastSpawnTime > spawnCooldown) && activeVines.length < maxVines) {
          vinesData.lastSpawnTime = currentTime;
          vinesData.nextVineId++;
          const edge = Math.floor(Math.random() * 4);
          let sx = 0, sy = 0;
          let startAngle = 0;
          if (edge === 0) { sx = -canvasWidth / 2; sy = Math.random() * canvasHeight - canvasHeight / 2; startAngle = 0; } // Left
          else if (edge === 1) { sx = canvasWidth / 2; sy = Math.random() * canvasHeight - canvasHeight / 2; startAngle = Math.PI; } // Right
          else if (edge === 2) { sx = Math.random() * canvasWidth - canvasWidth / 2; sy = -canvasHeight / 2; startAngle = Math.PI / 2; } // Bottom
          else { sx = Math.random() * canvasWidth - canvasWidth / 2; sy = canvasHeight / 2; startAngle = -Math.PI / 2; } // Top

          activeVines.push({
            id: vinesData.nextVineId,
            points: [{ x: sx, y: sy }],
            color: `hsla(${(SBNF_HUES_SCENE.lightLavender + Math.random() * 40 - 20)}, 80%, 70%, 0.7)`,
            opacity: 0.6 + Math.random() * 0.3,
            currentLength: 0,
            maxLength: 60 + Math.random() * 120, // Segments
            spawnTime: currentTime,
            lifetime: 4000 + Math.random() * 5000, // ms
            thickness: 1.5 + Math.random() * 2,
            curlFactor: 0.04 + Math.random() * 0.08,
            angle: startAngle + (Math.random() - 0.5) * (Math.PI / 3.5),
            speed: 0.6 + Math.random() * 1.2,
            startX: sx,
            startY: sy,
          });
        }

        for (let i = activeVines.length - 1; i >= 0; i--) {
          const vine = activeVines[i];
          const age = currentTime - vine.spawnTime;
          if (age > vine.lifetime || vine.opacity <= 0.01) {
            activeVines.splice(i, 1);
            continue;
          }
          vine.opacity = (1.0 - age / vine.lifetime) * (0.6 + Math.random() * 0.3);
          if (vine.currentLength < vine.maxLength) {
            const lastPoint = vine.points[vine.points.length - 1];
            const angleChange = (Math.sin(currentTime * 0.0011 * vine.curlFactor + vine.id) + Math.sin(currentTime * 0.0021 * vine.curlFactor + vine.id * 0.3)) * 0.18 * (audioData.rms * 0.5 + 0.2);
            vine.angle += angleChange;

            const segmentLength = vine.speed * (1 + audioData.midEnergy * 1.5);
            const newX = lastPoint.x + Math.cos(vine.angle) * segmentLength;
            const newY = lastPoint.y + Math.sin(vine.angle) * segmentLength;
            // Keep vines somewhat within view, or let them trail off? For now, let them trail.
            vine.points.push({ x: newX, y: newY });
            vine.currentLength++;
          }
        }
      }

       // Grape spawning and animation logic
       const grapesData = webGLAssets.grapesData;
       if (grapesData && grapesData.mesh && grapesData.grapeGeometry) {
         const { activeGrapes, spawnCooldown, maxGrapes, GRAPE_PARTICLE_COUNT_PER_CLUSTER } = grapesData;
         const positions = grapesData.grapeGeometry.attributes.position.array as Float32Array;
         const colors = grapesData.grapeGeometry.attributes.color.array as Float32Array;
         const sizes = grapesData.grapeGeometry.attributes.size.array as Float32Array;
         const lifetimes = (webGLAssets.lifetimesGrapes = webGLAssets.lifetimesGrapes || new Float32Array(GRAPE_PARTICLE_COUNT_PER_CLUSTER!));
         const spawnTimes = (webGLAssets.spawnTimesGrapes = webGLAssets.spawnTimesGrapes || new Float32Array(GRAPE_PARTICLE_COUNT_PER_CLUSTER!));
         const initialScales = (webGLAssets.initialScalesGrapes = webGLAssets.initialScalesGrapes || new Float32Array(GRAPE_PARTICLE_COUNT_PER_CLUSTER!));
         const targetScales = (webGLAssets.targetScalesGrapes = webGLAssets.targetScalesGrapes || new Float32Array(GRAPE_PARTICLE_COUNT_PER_CLUSTER!));
         const initialHues = (webGLAssets.initialHuesGrapes = webGLAssets.initialHuesGrapes || new Float32Array(GRAPE_PARTICLE_COUNT_PER_CLUSTER!));
         const targetHues = (webGLAssets.targetHuesGrapes = webGLAssets.targetHuesGrapes || new Float32Array(GRAPE_PARTICLE_COUNT_PER_CLUSTER!));

         let liveGrapeCount = 0;
         for(let k=0; k < GRAPE_PARTICLE_COUNT_PER_CLUSTER!; ++k) {
            if(lifetimes[k] > 0) liveGrapeCount++;
         }

         if (audioData.beat && (currentTime - grapesData.lastGrapeSpawnTime > spawnCooldown)) {
           grapesData.lastGrapeSpawnTime = currentTime;
           const numToSpawn = 5 + Math.floor(audioData.bassEnergy * 15);
           let spawnedThisBeat = 0;

           for (let k = 0; k < GRAPE_PARTICLE_COUNT_PER_CLUSTER! && spawnedThisBeat < numToSpawn; k++) {
             if (lifetimes[k] <= 0) { // Find a "dead" particle
               lifetimes[k] = 1.5 + Math.random() * 1.5; // seconds
               spawnTimes[k] = currentTime;
               initialScales[k] = 5 + audioData.bassEnergy * 20; // Initial size
               targetScales[k] = initialScales[k] * (0.2 + Math.random() * 0.4); // Target size for "pop"

               positions[k * 3 + 0] = (Math.random() - 0.5) * canvasWidth * 0.7;
               positions[k * 3 + 1] = (Math.random() - 0.5) * canvasHeight * 0.7;
               positions[k * 3 + 2] = (Math.random() - 0.5) * 20; // Slight depth variation

               initialHues[k] = SBNF_HUES_SCENE.lightLavender / 360;
               targetHues[k] = SBNF_HUES_SCENE.orangeRed / 360;

               spawnedThisBeat++;
               liveGrapeCount++;
             }
           }
         }

         for (let k = 0; k < GRAPE_PARTICLE_COUNT_PER_CLUSTER!; k++) {
           if (lifetimes[k] > 0) {
             const age = currentTime - spawnTimes[k];
             const lifeRatio = Math.min(1, age / (lifetimes[k]*1000)); // lifetime is in sec

             if (lifeRatio >= 1) {
               lifetimes[k] = 0; // Mark as dead
               sizes[k] = 0; // Hide
               continue;
             }

             // "Ripening" color
             const currentHue = initialHues[k] + (targetHues[k] - initialHues[k]) * lifeRatio;
             const grapeColor = new THREE.Color().setHSL(currentHue, 0.85, 0.6 + (1.0-lifeRatio) * 0.15);
             colors[k * 3 + 0] = grapeColor.r;
             colors[k * 3 + 1] = grapeColor.g;
             colors[k * 3 + 2] = grapeColor.b;

             // Size "Pop" animation
             const scaleProgress = Math.sin(lifeRatio * Math.PI); // Pop in and out
             sizes[k] = initialScales[k] * scaleProgress * (1 + audioData.rms * 0.3) * settings.brightCap;

             lifetimes[k] -= (currentTime - (webGLAssets.lastGrapeUpdateTime || currentTime)) / 1000; // Decrement lifetime in seconds
           } else {
             sizes[k] = 0; // Ensure dead particles are not visible
           }
         }
         webGLAssets.lastGrapeUpdateTime = currentTime;

         grapesData.grapeGeometry.attributes.position.needsUpdate = true;
         grapesData.grapeGeometry.attributes.color.needsUpdate = true;
         grapesData.grapeGeometry.attributes.size.needsUpdate = true;
       }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets.videoTexture) webGLAssets.videoTexture.dispose();
      if (webGLAssets.planeMesh) {
        if (webGLAssets.planeMesh.geometry) webGLAssets.planeMesh.geometry.dispose();
        if (webGLAssets.planeMesh.material) (webGLAssets.planeMesh.material as THREE.ShaderMaterial).dispose(); // Cast to ShaderMaterial
      }
      if (webGLAssets.shaderMaterial) webGLAssets.shaderMaterial.dispose();
      if (webGLAssets.noiseTexture) webGLAssets.noiseTexture.dispose();

      // Cleanup grapes
      if (webGLAssets.grapesData) {
        if (webGLAssets.grapesData.mesh) {
          webGLAssets.scene?.remove(webGLAssets.grapesData.mesh);
        }
        if (webGLAssets.grapesData.grapeGeometry) webGLAssets.grapesData.grapeGeometry.dispose();
        if (webGLAssets.grapesData.grapeBaseMaterial) webGLAssets.grapesData.grapeBaseMaterial.dispose();
        webGLAssets.grapesData.activeGrapes = [];
      }
      // Vines are 2D, handled by overlay canvas, no specific WebGL cleanup here for them.
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    displayLabel: 'ECHO',
    rendererType: 'webgl', // Changed to WebGL
    dataAiHint: 'geometric shapes audio pulse',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeYellow.toString(16)}.png`,
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const MAX_SHAPE_INSTANCES = 50; // Max instances per shape type

      const circleGeometry = new THREE.CircleGeometry(0.5, 32);
      const squareGeometry = new THREE.PlaneGeometry(1, 1);
      const triangleShape = new THREE.Shape();
      triangleShape.moveTo(-0.5, -0.433);
      triangleShape.lineTo(0.5, -0.433);
      triangleShape.lineTo(0, 0.433);
      triangleShape.closePath();
      const triangleGeometry = new THREE.ShapeGeometry(triangleShape);

      // Material that supports instance colors
      const instancedMaterial = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const circleInstancedMesh = new THREE.InstancedMesh(circleGeometry, instancedMaterial, MAX_SHAPE_INSTANCES);
      const squareInstancedMesh = new THREE.InstancedMesh(squareGeometry, instancedMaterial, MAX_SHAPE_INSTANCES);
      const triangleInstancedMesh = new THREE.InstancedMesh(triangleGeometry, instancedMaterial, MAX_SHAPE_INSTANCES);

      scene.add(circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh);

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene,
        camera,
        circleInstancedMesh,
        squareInstancedMesh,
        triangleInstancedMesh,
        instancedMaterial, // Store the material for cleanup
        circleGeometry, // Store base geometries for cleanup
        squareGeometry,
        triangleGeometry,
        activeInstances: [], // Tracks properties of live instances
        nextInstanceId: 0,
        maxShapeInstances: MAX_SHAPE_INSTANCES,
        dummy: new THREE.Object3D(),
        tempColor: new THREE.Color(),
        lastSpawnTime: 0,
        spawnCooldown: 100, // ms
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const {
        scene, camera, // These are now part of webGLAssets
        circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh,
        activeInstances, maxShapeInstances, dummy, tempColor, spawnCooldown
      } = webGLAssets;

      const bgColor = new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0.0, 0.03); // Very dark for SBNF
      renderer.setClearColor(bgColor, 1.0); // Opaque clear

      const shouldSpawn = (audioData.beat && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown / 2.5)) ||
                          (audioData.rms > 0.12 && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown * 1.2));

      const totalMaxInstances = maxShapeInstances! * 3; // Max instances across all types

      if (shouldSpawn && activeInstances!.length < totalMaxInstances) {
        webGLAssets.lastSpawnTime = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 4);

        for (let i = 0; i < numToSpawn && activeInstances!.length < totalMaxInstances; i++) {
          const shapeTypeIndex = Math.floor(Math.random() * 3); // 0: circle, 1: square, 2: triangle
          let shapeType: 'circle' | 'square' | 'triangle';
          if (shapeTypeIndex === 0) shapeType = 'circle';
          else if (shapeTypeIndex === 1) shapeType = 'square';
          else shapeType = 'triangle';

          const initialScale = (canvasWidth / 25) * (0.4 + audioData.bassEnergy * 1.0);
          const lifetime = 1200 + Math.random() * 1800;

          const SBNF_SHAPE_HUES = [SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed];
          const baseHue = SBNF_SHAPE_HUES[Math.floor(Math.random() * SBNF_SHAPE_HUES.length)];
          const finalHue = (baseHue + (currentTime * 0.015) + (audioData.trebleEnergy * 50)) % 360;

          webGLAssets.nextInstanceId!++;
          activeInstances!.push({
            id: webGLAssets.nextInstanceId!,
            type: shapeType,
            matrix: new THREE.Matrix4(), // Will be updated
            color: new THREE.Color().setHSL(finalHue / 360, 0.75, 0.65),
            x: (Math.random() - 0.5) * canvasWidth * 0.85,
            y: (Math.random() - 0.5) * canvasHeight * 0.85,
            z: (Math.random() - 0.5) * 8,
            initialScale,
            maxScale: initialScale * (1.6 + audioData.rms * 2.2),
            rotationSpeed: (Math.random() - 0.5) * 0.06,
            rotation: Math.random() * Math.PI * 2,
            spawnTime: currentTime,
            lifetime, // Total lifetime
            initialLifetime: lifetime, // Store initial for ratio calc
            currentOpacity: Math.min(0.8, 0.4 + audioData.rms * 0.6) * settings.brightCap, // Start with this opacity
            targetOpacity: Math.min(0.8, 0.4 + audioData.rms * 0.6) * settings.brightCap, // Not used for fade, but for initial setting
          });
        }
      }

      let circleIdx = 0, squareIdx = 0, triangleIdx = 0;

      for (let i = activeInstances!.length - 1; i >= 0; i--) {
        const instance = activeInstances![i];
        const age = currentTime - instance.spawnTime;
        const lifeRatio = age / instance.initialLifetime;

        if (lifeRatio >= 1) {
          activeInstances!.splice(i, 1);
          continue;
        }

        instance.rotation += instance.rotationSpeed * (1 + audioData.midEnergy * 0.8);
        const scaleProgress = Math.sin(lifeRatio * Math.PI); // Pop in and out smoothly
        const currentScale = instance.initialScale + (instance.maxScale - instance.initialScale) * scaleProgress;

        dummy!.position.set(instance.x, instance.y, instance.z);
        dummy!.rotation.z = instance.rotation;
        dummy!.scale.set(currentScale, currentScale, currentScale);
        dummy!.updateMatrix();

        const currentAlpha = instance.currentOpacity * (1.0 - Math.pow(lifeRatio, 2)); // Fade out faster at the end
        tempColor!.copy(instance.color).multiplyScalar(currentAlpha); // Apply opacity to color for additive blending

        let targetMesh: THREE.InstancedMesh | undefined;
        let instanceIndex: number | undefined;

        if (instance.type === 'circle' && circleIdx < maxShapeInstances!) {
          targetMesh = circleInstancedMesh!;
          instanceIndex = circleIdx++;
        } else if (instance.type === 'square' && squareIdx < maxShapeInstances!) {
          targetMesh = squareInstancedMesh!;
          instanceIndex = squareIdx++;
        } else if (instance.type === 'triangle' && triangleIdx < maxShapeInstances!) {
          targetMesh = triangleInstancedMesh!;
          instanceIndex = triangleIdx++;
        }

        if (targetMesh && instanceIndex !== undefined) {
          targetMesh.setMatrixAt(instanceIndex, dummy!.matrix);
          targetMesh.setColorAt(instanceIndex, tempColor!);
        } else {
          // If max instances for this type are reached, remove older ones
          activeInstances!.splice(i, 1);
        }
      }

      circleInstancedMesh!.count = circleIdx;
      squareInstancedMesh!.count = squareIdx;
      triangleInstancedMesh!.count = triangleIdx;

      if (circleIdx > 0) {
        circleInstancedMesh!.instanceMatrix.needsUpdate = true;
        circleInstancedMesh!.instanceColor!.needsUpdate = true;
      }
      if (squareIdx > 0) {
        squareInstancedMesh!.instanceMatrix.needsUpdate = true;
        squareInstancedMesh!.instanceColor!.needsUpdate = true;
      }
      if (triangleIdx > 0) {
        triangleInstancedMesh!.instanceMatrix.needsUpdate = true;
        triangleInstancedMesh!.instanceColor!.needsUpdate = true;
      }
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.circleInstancedMesh?.dispose();
      webGLAssets.squareInstancedMesh?.dispose();
      webGLAssets.triangleInstancedMesh?.dispose();
      webGLAssets.instancedMaterial?.dispose();
      webGLAssets.circleGeometry?.dispose();
      webGLAssets.squareGeometry?.dispose();
      webGLAssets.triangleGeometry?.dispose();
      webGLAssets.activeInstances = [];
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    displayLabel: 'RINGS',
    rendererType: 'webgl',
    dataAiHint: 'concentric rings audio frequency',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.deepPurple.toString(16)}/${SBNF_HUES_SCENE.tronBlue.toString(16)}.png`, // SBNF Deep Purple, Tron Blue
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      // Shared geometry for all rings
      const ringGeometry = new THREE.RingGeometry(0.48, 0.5, 64); // Thin ring (radius 0.5, thickness 0.02)

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene,
        camera,
        ringGeometry, // Store for cleanup
        activeRings: [], // Will store { mesh, spawnTime, lifetime, initialOpacity, maxScale, band }
        lastSpawnTimes: { bass: 0, mid: 0, treble: 0 },
        spawnCooldown: 50, // ms
        maxRingsPerBand: 15, // Max rings for each band simultaneously
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const { scene, ringGeometry, activeRings, lastSpawnTimes, spawnCooldown, maxRingsPerBand } = webGLAssets;

      // SBNF Palette for Rings
      const SBNF_RING_COLORS = {
        bass: new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeRed / 360, 0.95, 0.6),
        mid: new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeYellow / 360, 0.9, 0.65),
        treble: new THREE.Color().setHSL(SBNF_HUES_SCENE.lightLavender / 360, 0.85, 0.7),
      };

      const spawnRing = (band: 'bass' | 'mid' | 'treble', energy: number) => {
        const bandRings = activeRings!.filter(r => r.band === band);
        if (energy > 0.08 && currentTime - lastSpawnTimes![band] > spawnCooldown! && bandRings.length < maxRingsPerBand!) {
          lastSpawnTimes![band] = currentTime;
          const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().copy(SBNF_RING_COLORS[band]).multiplyScalar(0.5 + energy * 0.8), // Modulate base color
            transparent: true,
            opacity: Math.min(0.9, 0.4 + energy * 0.6),
            side: THREE.DoubleSide,
          });
          const ringMesh = new THREE.Mesh(ringGeometry, material); // Use shared geometry
          ringMesh.scale.set(canvasWidth * 0.03, canvasWidth * 0.03, 1); // Start smaller
          scene!.add(ringMesh);
          activeRings!.push({
            mesh: ringMesh,
            spawnTime: currentTime,
            lifetime: 800 + energy * 1200,
            initialOpacity: material.opacity,
            maxScale: canvasWidth * (0.7 + energy * 0.5), // Max expansion based on energy
            band,
          });
        }
      };

      spawnRing('bass', audioData.bassEnergy,);
      spawnRing('mid', audioData.midEnergy);
      spawnRing('treble', audioData.trebleEnergy);

      for (let i = activeRings!.length - 1; i >= 0; i--) {
        const ring = activeRings![i];
        const age = currentTime - ring.spawnTime;
        const lifeRatio = Math.min(1, age / ring.lifetime);

        if (lifeRatio >= 1) {
          scene!.remove(ring.mesh);
          ring.mesh.material.dispose(); // Dispose material as it's unique per ring
          activeRings!.splice(i, 1);
          continue;
        }

        const scale = canvasWidth * 0.03 + lifeRatio * ring.maxScale;
        ring.mesh.scale.set(scale, scale, 1);
        ring.mesh.material.opacity = ring.initialOpacity * (1.0 - Math.pow(lifeRatio, 1.5)) * settings.brightCap; // Fade out faster
      }
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.activeRings?.forEach(ring => {
        webGLAssets.scene?.remove(ring.mesh);
        ring.mesh.material.dispose();
      });
      webGLAssets.activeRings = [];
      webGLAssets.ringGeometry?.dispose(); // Dispose shared geometry
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    displayLabel: 'GRID',
    rendererType: 'webgl',
    dataAiHint: 'pulsing grid light cells audio',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeRed.toString(16)}.png`, // SBNF Black, Orange-Red
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const GRID_SIZE_X = 16;
      const GRID_SIZE_Y = Math.round(GRID_SIZE_X * (canvas.height / canvas.width)) || 1; // Ensure at least 1
      const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

      const cellGeometry = new THREE.PlaneGeometry(1, 1); // Base geometry
      const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: true }); // Use instance colors
      const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, totalCells);
      scene.add(instancedMesh);

      const cellBaseWidth = canvas.width / GRID_SIZE_X;
      const cellBaseHeight = canvas.height / GRID_SIZE_Y;
      const dummy = new THREE.Object3D();
      const cellStates = []; // For individual cell animation states

      for (let y = 0; y < GRID_SIZE_Y; y++) {
        for (let x = 0; x < GRID_SIZE_X; x++) {
          const i = y * GRID_SIZE_X + x;
          dummy.position.set(
            (x - GRID_SIZE_X / 2 + 0.5) * cellBaseWidth,
            (y - GRID_SIZE_Y / 2 + 0.5) * cellBaseHeight,
            0
          );
          dummy.scale.set(cellBaseWidth * 0.85, cellBaseHeight * 0.85, 1); // 0.85 for spacing
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
          // Initial color using SBNF Black as dim base
          instancedMesh.setColorAt(i, new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.05));
          cellStates.push({ currentLightness: 0.05, targetLightness: 0.05, lastPulseTime: 0, hue: 0 });
        }
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.instanceColor!.needsUpdate = true;

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, instancedMesh, cellGeometry, cellMaterial,
        GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellStates,
        dummy, tempColor: new THREE.Color(),
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets }) => {
      const { instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, cellStates, tempColor } = webGLAssets;
      const currentTime = performance.now();

      // SBNF Black background with slight trail
      renderer.setClearColor(new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.01), 0.2);

      const spectrum = audioData.spectrum;
      const spectrumLength = spectrum.length;
      const SBNF_PULSE_HUES = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      for (let i = 0; i < webGLAssets.totalCells!; i++) {
        const spectrumIndex = Math.floor((i / webGLAssets.totalCells!) * spectrumLength);
        const energy = (spectrum[spectrumIndex] / 255);

        const cellState = cellStates![i];
        if (audioData.beat && energy > 0.35 && (currentTime - cellState.lastPulseTime > 80)) {
          cellState.targetLightness = 0.5 + energy * 0.5; // Brighter pulse on beat
          cellState.lastPulseTime = currentTime;
          // Cycle hue on pulse for variety
          cellState.hue = SBNF_PULSE_HUES[Math.floor(Math.random() * SBNF_PULSE_HUES.length)];
        } else {
          cellState.targetLightness = 0.05 + energy * 0.3; // Base energy glow
        }

        cellState.currentLightness += (cellState.targetLightness - cellState.currentLightness) * 0.12; // Smoother interpolation

        tempColor!.setHSL(
          (cellState.hue || SBNF_HUES_SCENE.deepPurple) / 360, // Use stored hue or default
          0.75 + energy * 0.25, // Saturation increases with energy
          Math.max(0.02, cellState.currentLightness * settings.brightCap) // Ensure minimum visibility, apply brightCap
        );
        instancedMesh!.setColorAt(i, tempColor!);
      }
      instancedMesh!.instanceColor!.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.instancedMesh?.dispose();
      webGLAssets.cellGeometry?.dispose();
      webGLAssets.cellMaterial?.dispose();
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    displayLabel: 'BARS',
    rendererType: 'webgl',
    dataAiHint: 'frequency bars audio spectrum',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeRed.toString(16)}.png`, // SBNF Black, Orange-Red
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const numBars = Math.floor(settings.fftSize / 2); // Ensure integer
      const barGeometry = new THREE.PlaneGeometry(1, 1);
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      scene.add(instancedMesh);

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, instancedMesh, barGeometry, barMaterial, numBars,
        dummy: new THREE.Object3D(), tempColor: new THREE.Color(),
        lastCanvasWidth: 0, lastCanvasHeight: 0,
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const { instancedMesh, numBars, dummy, tempColor } = webGLAssets;
      const spectrum = audioData.spectrum;

      // SBNF Deep Purple background
      renderer.setClearColor(new THREE.Color().setHSL(SBNF_HUES_SCENE.deepPurple / 360, 0.56, 0.47), 1.0);

      const barActualWidth = canvasWidth / numBars!;
      const SBNF_BAR_HUES = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];

      const spectrumSumForSilenceCheck = spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.015 && spectrumSumForSilenceCheck < (spectrum.length * 0.8); // Adjusted threshold

      for (let i = 0; i < numBars!; i++) {
        const value = isAudioSilent ? 0.002 : spectrum[i] / 255;
        const effectiveBrightCap = Math.max(0.1, settings.brightCap);
        const barHeight = Math.max(1, value * canvasHeight * 0.85 * effectiveBrightCap * (1 + audioData.rms * 0.4));

        const hueTimeShift = performance.now() * 0.00003;
        const hueIndex = Math.floor((i / numBars!) * SBNF_BAR_HUES.length + hueTimeShift) % SBNF_BAR_HUES.length;
        const hue = SBNF_BAR_HUES[hueIndex];
        const saturation = 0.7 + value * 0.3;
        const lightness = 0.45 + value * 0.3 + (audioData.beat ? 0.1 : 0);

        tempColor!.setHSL(hue / 360, saturation, Math.min(0.8, lightness));

        dummy!.position.set(
          (i - numBars! / 2 + 0.5) * barActualWidth,
          barHeight / 2 - canvasHeight / 2,
          0
        );
        dummy!.scale.set(barActualWidth * 0.9, barHeight, 1);
        dummy!.updateMatrix();

        instancedMesh!.setMatrixAt(i, dummy!.matrix);
        instancedMesh!.setColorAt(i, tempColor!);
      }
      instancedMesh!.instanceMatrix.needsUpdate = true;
      instancedMesh!.instanceColor!.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.instancedMesh?.dispose();
      webGLAssets.barGeometry?.dispose();
      webGLAssets.barMaterial?.dispose();
    },
  },
  {
    id: 'radial_burst',
    name: 'Radial Burst',
    displayLabel: 'BURST',
    rendererType: 'webgl',
    dataAiHint: 'particle explosion audio beat',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeRed.toString(16)}.png`,
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 300;

      const PARTICLE_COUNT = 4000; // Adjusted from 5000
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT);
      const initialLifetimes = new Float32Array(PARTICLE_COUNT); // To store initial for fading

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        depthWrite: false,
      });
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes[i] = 0; // Initialize as "dead"
        const pIdx = i * 3;
        positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 10000; // Move off-screen
      }

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, particles, particleMaterial: material, particleGeometry: geometry,
        positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT,
        lastBeatTime: 0, lastAmbientSpawnTime: 0, lastFrameTimeWebGL: performance.now(),
        tempColor: new THREE.Color(),
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL!) / 1000;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      const { particles, positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT, tempColor } = webGLAssets;

      renderer.setClearColor(new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.02), 0.2); // Darker SBNF Black, more trails

      const beatCooldown = 80; // ms
      const dragFactor = 0.965;
      const SBNF_BURST_HUES_RADIAL = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
      const SBNF_AMBIENT_HUES_RADIAL = [SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.lightLavender];

      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime! > beatCooldown)) {
        webGLAssets.lastBeatTime = currentTime;
        let burstSpawned = 0;
        const maxBurstParticlesThisBeat = Math.floor(PARTICLE_COUNT! * (0.08 + audioData.bassEnergy * 0.22)); // Reduced multiplier

        for (let i = 0; i < PARTICLE_COUNT! && burstSpawned < maxBurstParticlesThisBeat; i++) {
          if (lifetimes![i] <= 0) {
            const pIdx = i * 3;
            positions![pIdx] = positions![pIdx + 1] = positions![pIdx + 2] = 0;
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos((Math.random() * 2) - 1);
            const speed = 120 + (audioData.rms + audioData.bassEnergy * 1.5) * 220 * (Math.random() * 0.4 + 0.8);
            velocities![pIdx] = Math.sin(theta) * Math.cos(phi) * speed;
            velocities![pIdx + 1] = Math.sin(theta) * Math.sin(phi) * speed;
            velocities![pIdx + 2] = Math.cos(theta) * speed;
            initialLifetimes![i] = 1.2 + Math.random() * 1.3;
            lifetimes![i] = initialLifetimes![i];
            const hue = SBNF_BURST_HUES_RADIAL[Math.floor(Math.random() * SBNF_BURST_HUES_RADIAL.length)];
            tempColor!.setHSL(hue / 360, 0.95, 0.65 + Math.random() * 0.15);
            colors![pIdx] = tempColor!.r; colors![pIdx + 1] = tempColor!.g; colors![pIdx + 2] = tempColor!.b;
            burstSpawned++;
          }
        }
      }

      let ambientSpawnedThisFrame = 0;
      const maxAmbientSpawnPerFrame = Math.floor(PARTICLE_COUNT! * 0.02); // Reduced cap
      if (audioData.rms > 0.03 && (currentTime - webGLAssets.lastAmbientSpawnTime! > 50)) {
        webGLAssets.lastAmbientSpawnTime = currentTime;
        for (let i = 0; i < PARTICLE_COUNT! && ambientSpawnedThisFrame < maxAmbientSpawnPerFrame; i++) {
          if (lifetimes![i] <= 0) {
            const pIdx = i * 3;
            positions![pIdx] = positions![pIdx + 1] = positions![pIdx + 2] = 0;
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos((Math.random() * 2) - 1);
            const speed = 35 + audioData.rms * 120 * (Math.random() * 0.5 + 0.4);
            velocities![pIdx] = Math.sin(theta) * Math.cos(phi) * speed;
            velocities![pIdx + 1] = Math.sin(theta) * Math.sin(phi) * speed;
            velocities![pIdx + 2] = Math.cos(theta) * speed;
            initialLifetimes![i] = 1.8 + Math.random() * 2.2;
            lifetimes![i] = initialLifetimes![i];
            const hue = SBNF_AMBIENT_HUES_RADIAL[Math.floor(Math.random() * SBNF_AMBIENT_HUES_RADIAL.length)];
            tempColor!.setHSL(hue / 360, 0.75, 0.55 + Math.random() * 0.1);
            colors![pIdx] = tempColor!.r; colors![pIdx + 1] = tempColor!.g; colors![pIdx + 2] = tempColor!.b;
            ambientSpawnedThisFrame++;
          }
        }
      }

      for (let i = 0; i < PARTICLE_COUNT!; i++) {
        if (lifetimes![i] > 0) {
          const pIdx = i * 3;
          positions![pIdx] += velocities![pIdx] * deltaTime;
          positions![pIdx + 1] += velocities![pIdx + 1] * deltaTime;
          positions![pIdx + 2] += velocities![pIdx + 2] * deltaTime;
          velocities![pIdx] *= dragFactor; velocities![pIdx + 1] *= dragFactor; velocities![pIdx + 2] *= dragFactor;
          lifetimes![i] -= deltaTime;
          const lifeRatio = Math.max(0, lifetimes![i] / initialLifetimes![i]);
          const fade = Math.pow(lifeRatio, 0.75); // Eased fade
          colors![pIdx] *= fade; colors![pIdx + 1] *= fade; colors![pIdx + 2] *= fade;
          if (lifetimes![i] <= 0) {
            positions![pIdx] = positions![pIdx + 1] = positions![pIdx + 2] = 10000;
          }
        }
      }

      webGLAssets.particleMaterial!.size = Math.max(1, 2.5 + settings.brightCap * 2.5 + audioData.rms * 4);
      webGLAssets.particleMaterial!.opacity = Math.min(0.9, 0.6 + settings.brightCap * 0.3 + audioData.rms * 0.3);
      particles!.geometry.attributes.position.needsUpdate = true;
      particles!.geometry.attributes.color.needsUpdate = true;

      const camera = webGLAssets.camera as THREE.PerspectiveCamera;
      camera.position.z = 300 - audioData.rms * 120;
      camera.fov = 75 - audioData.rms * 15;
      camera.updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.particleGeometry?.dispose();
      webGLAssets.particleMaterial?.dispose();
    },
  },
  {
    id: 'geometric_tunnel',
    name: 'Geometric Tunnel',
    displayLabel: 'TUNNEL',
    rendererType: 'webgl',
    dataAiHint: 'geometric tunnel flight tron',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.tronBlue.toString(16)}.png`, // SBNF Black, Tron Blue
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const cameraBaseFov = 70;
      const camera = new THREE.PerspectiveCamera(cameraBaseFov, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 0; // Start inside the tunnel

      const NUM_SEGMENTS = 25; // Reduced for potentially better perf
      const SEGMENT_SPACING = 60; // Slightly more spacing
      const tunnelSegments: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];

      // SBNF Tron-like colors
      const SBNF_TRON_HUES = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow];

      for (let i = 0; i < NUM_SEGMENTS; i++) {
        const segmentGeometry = new THREE.TorusGeometry(25, 1.2, 8, 32); // Slightly thicker tube
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(SBNF_TRON_HUES[i % SBNF_TRON_HUES.length] / 360, 0.9, 0.6),
          wireframe: true,
          transparent: true,
          opacity: 0.75
        });
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * SEGMENT_SPACING;
        // Initial rotation for variety
        segment.rotation.x = Math.random() * Math.PI;
        segment.rotation.y = Math.random() * Math.PI;
        scene.add(segment);
        tunnelSegments.push(segment);
      }

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, tunnelSegments, NUM_SEGMENTS, SEGMENT_SPACING,
        cameraBaseFov, lastFrameTimeWebGL: performance.now(), tempColor: new THREE.Color(),
        sbnfTronHues: SBNF_TRON_HUES, // Store for use in draw loop
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL!) / 1000;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      const { scene, camera, tunnelSegments, NUM_SEGMENTS, SEGMENT_SPACING, cameraBaseFov, tempColor, sbnfTronHues } = webGLAssets;

      renderer.setClearColor(new THREE.Color().setHSL(SBNF_HUES_SCENE.black/360, 0, 0.01), 1); // SBNF Black background

      const speed = 35 + audioData.rms * 120 + audioData.bpm * 0.08;
      camera!.position.z -= speed * deltaTime;

      tunnelSegments!.forEach((segment, i) => {
        if (segment.position.z > camera!.position.z + SEGMENT_SPACING!) { // Adjusted recycling condition
          segment.position.z -= NUM_SEGMENTS! * SEGMENT_SPACING!;
          // Optionally re-randomize some properties on recycle for more dynamism
          segment.material.color.setHSL(sbnfTronHues![Math.floor(Math.random() * sbnfTronHues!.length)] / 360, 0.9, 0.6);
        }

        const scaleFactor = 1 + Math.sin(currentTime * 0.0012 + i * 0.6) * 0.12 + audioData.bassEnergy * 0.25;
        segment.scale.set(scaleFactor, scaleFactor, scaleFactor);

        const hueTimeFactor = currentTime * 0.00015;
        const hueIndex = Math.floor(hueTimeFactor + i * 0.25) % sbnfTronHues!.length;
        const hue = sbnfTronHues![hueIndex];
        const saturation = 0.75 + audioData.midEnergy * 0.25;
        const lightness = 0.5 + audioData.trebleEnergy * 0.25 + (audioData.beat && i % 4 === 0 ? 0.15 : 0);

        segment.material.color.setHSL(hue / 360, saturation, Math.min(0.75, lightness));
        segment.material.opacity = Math.min(0.85, 0.6 + audioData.rms * 0.4 * settings.brightCap);

        segment.rotation.z += (audioData.trebleEnergy * 0.02 + 0.0005 + audioData.bpm * 0.000015) * (i % 2 === 0 ? 1.1 : -1.3) * deltaTime * 60;
        segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0005 + i * 0.4) * audioData.midEnergy * 0.5;
      });

      (camera as THREE.PerspectiveCamera).fov = cameraBaseFov! - audioData.rms * 30 * settings.gamma + (audioData.beat ? 6 : 0);
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.tunnelSegments?.forEach(segment => {
        segment.geometry.dispose();
        segment.material.dispose();
        webGLAssets.scene?.remove(segment);
      });
      webGLAssets.tunnelSegments = [];
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    displayLabel: 'STROBE',
    rendererType: 'webgl',
    dataAiHint: 'flashing light beat strobe',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.lightPeach.toString(16)}.png`, // SBNF Black, Light Peach
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0), // Start black
        transparent: true,
        opacity: 1.0
      });
      const flashPlane = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(flashPlane);

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, flashPlane, planeMaterial, // Keep planeGeometry if needed for disposal
        lastFlashTime: 0,
        flashActive: false,
        flashDuration: 60, // ms
        tempColor: new THREE.Color(),
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets }) => {
      const { flashPlane, planeMaterial, tempColor } = webGLAssets;
      const currentTime = performance.now();

      // Set clear color to SBNF black, but only clear if no flash is active
      // This allows the flashPlane to dominate when visible
      if (!webGLAssets.flashActive) {
        renderer.setClearColor(new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.01), 1.0);
      }


      if (webGLAssets.flashActive) {
        if (currentTime - webGLAssets.lastFlashTime! > webGLAssets.flashDuration!) {
          webGLAssets.flashActive = false;
          planeMaterial!.color.setHSL(SBNF_HUES_SCENE.black / 360, 0, 0); // Return to black
          planeMaterial!.opacity = 1.0; // Ensure it's opaque black
        } else {
          // Optionally fade the flash color/opacity quickly during its short duration
          const timeSinceFlash = currentTime - webGLAssets.lastFlashTime!;
          const fadeRatio = 1.0 - Math.min(1.0, timeSinceFlash / webGLAssets.flashDuration!);
          planeMaterial!.opacity = settings.brightCap * fadeRatio;
        }
      } else if (audioData.beat && (currentTime - webGLAssets.lastFlashTime! > 100)) { // Cooldown
        webGLAssets.lastFlashTime = currentTime;
        webGLAssets.flashActive = true;
        const hue = (SBNF_HUES_SCENE.orangeYellow + Math.random() * 50 - 25) % 360; // SBNF Yellows/Oranges/Peaches
        tempColor!.setHSL(hue / 360, 0.95, 0.75); // Bright flash
        planeMaterial!.color.copy(tempColor!);
        planeMaterial!.opacity = settings.brightCap;
      }

      flashPlane!.visible = webGLAssets.flashActive; // Only visible during active flash
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.flashPlane?.geometry.dispose();
      webGLAssets.planeMaterial?.dispose();
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    displayLabel: 'FINALE',
    rendererType: 'webgl',
    dataAiHint: 'particle system burst stars SBNF colors',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeRed.toString(16)}.png`, // SBNF Black, Orange-Red
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 350;

      const PARTICLE_COUNT = 3000; // Reduced from 3500
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT);
      const initialLifetimes = new Float32Array(PARTICLE_COUNT); // Used for color/alpha fading

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 3.0, // Slightly reduced base size
        vertexColors: true,
        transparent: true,
        opacity: 0.85, // Slightly reduced base opacity
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        depthWrite: false,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Initialize all particles as "dead" (lifetime 0) and off-screen
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes[i] = 0;
        const pIdx = i * 3;
        positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 10000; // Move far off-screen
      }

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, particles, particleMaterial: material, particleGeometry: geometry,
        positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT,
        lastBeatTime: 0, // Initialize to allow first beat trigger
        lastFrameTimeWebGL: performance.now(),
        tempColor: new THREE.Color(),
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL!) / 1000;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      const { particles, positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT, tempColor } = webGLAssets;

      renderer.setClearColor(new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0, 0.015), 0.15); // SBNF black, slightly more trails

      const beatCooldown = 100; // ms between beat bursts
      const dragFactor = 0.968; // Slightly stronger drag
      const SBNF_FINALE_HUES = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime! > beatCooldown)) {
        webGLAssets.lastBeatTime = currentTime;
        let spawnedCount = 0;
        const particlesToSpawnOnBeat = Math.floor(PARTICLE_COUNT! * 0.20); // Max 20% of particles per beat burst

        for (let i = 0; i < PARTICLE_COUNT! && spawnedCount < particlesToSpawnOnBeat; i++) {
          if (lifetimes![i] <= 0) { // Find a "dead" particle
            const pIdx = i * 3;
            // Spawn near center with slight randomness
            positions![pIdx] = (Math.random() - 0.5) * 20;
            positions![pIdx + 1] = (Math.random() - 0.5) * 20;
            positions![pIdx + 2] = (Math.random() - 0.5) * 20;

            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos((Math.random() * 2) - 1); // More uniform sphere distribution
            const speed = 180 + (audioData.rms + audioData.bassEnergy * 1.2) * 280 * (0.7 + Math.random() * 0.6); // Stronger burst
            velocities![pIdx] = Math.sin(theta) * Math.cos(phi) * speed;
            velocities![pIdx + 1] = Math.sin(theta) * Math.sin(phi) * speed;
            velocities![pIdx + 2] = Math.cos(theta) * speed;

            initialLifetimes![i] = 1.6 + Math.random() * 2.0; // Slightly shorter, more varied lifetimes
            lifetimes![i] = initialLifetimes![i];

            const hue = SBNF_FINALE_HUES[Math.floor(Math.random() * SBNF_FINALE_HUES.length)];
            const baseLightness = 50 + Math.random() * 20; // Range 50-70
            const lightnessVariation = (audioData.beat ? 10 : 0) + (audioData.rms * 10);
            const finalLightness = Math.min(70, baseLightness + lightnessVariation); // Cap lightness to avoid pure white
            tempColor!.setHSL(hue / 360, 0.9 + Math.random() * 0.1, finalLightness / 100);
            colors![pIdx] = tempColor!.r; colors![pIdx + 1] = tempColor!.g; colors![pIdx + 2] = tempColor!.b;
            spawnedCount++;
          }
        }
      }

      for (let i = 0; i < PARTICLE_COUNT!; i++) {
        if (lifetimes![i] > 0) {
          const pIdx = i * 3;
          positions![pIdx] += velocities![pIdx] * deltaTime;
          positions![pIdx + 1] += velocities![pIdx + 1] * deltaTime;
          positions![pIdx + 2] += velocities![pIdx + 2] * deltaTime;

          velocities![pIdx] *= dragFactor; velocities![pIdx + 1] *= dragFactor; velocities![pIdx + 2] *= dragFactor;

          lifetimes![i] -= deltaTime;

          const lifeRatio = Math.max(0, lifetimes![i] / initialLifetimes![i]);
          const fadeFactor = Math.pow(lifeRatio, 0.6); // Eased fade, slightly slower start to fade

          // Get original spawn color components for this particle
          const originalR = colors![pIdx] / fadeFactor; // Approx. inverse of previous fade
          const originalG = colors![pIdx+1] / fadeFactor;
          const originalB = colors![pIdx+2] / fadeFactor;

          colors![pIdx] = originalR * fadeFactor;
          colors![pIdx + 1] = originalG * fadeFactor;
          colors![pIdx + 2] = originalB * fadeFactor;


          if (lifetimes![i] <= 0) {
            positions![pIdx] = 10000; positions![pIdx + 1] = 10000; positions![pIdx + 2] = 10000;
             // Ensure dead particles are fully transparent by zeroing color
            colors![pIdx] = 0; colors![pIdx + 1] = 0; colors![pIdx + 2] = 0;
          }
        }
      }

      particles!.geometry.attributes.position.needsUpdate = true;
      particles!.geometry.attributes.color.needsUpdate = true;

      webGLAssets.particleMaterial!.size = Math.max(1.2, 2.8 + settings.brightCap * 2.8 + audioData.rms * 3.5); // Slightly adjusted size reactivity
      webGLAssets.particleMaterial!.opacity = Math.min(0.9, 0.55 + settings.brightCap * 0.35 + audioData.rms * 0.35); // Adjusted opacity

      const camera = webGLAssets.camera as THREE.PerspectiveCamera;
      const targetZ = 350 - audioData.rms * 80 - (audioData.beat ? 15 : 0); // Less drastic zoom
      camera.position.z += (targetZ - camera.position.z) * 0.06; // Smoother zoom
      const targetFov = 75 - audioData.rms * 12 - (audioData.beat ? 4 : 0); // Less drastic FOV change
      camera.fov += (targetFov - camera.fov) * 0.06;
      camera.updateProjectionMatrix();

      particles!.rotation.y += audioData.midEnergy * 0.0008 + 0.00015; // Slower rotation
      particles!.rotation.x += audioData.trebleEnergy * 0.0006 + 0.0001;
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.particleGeometry?.dispose();
      webGLAssets.particleMaterial?.dispose();
      webGLAssets.scene?.remove(webGLAssets.particles!);
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";
