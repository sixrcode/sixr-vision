
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
  mirrorWebcam: true, // Default mirror to on for SBNF
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
    thumbnailUrl: `https://placehold.co/120x80/${SBNF_HUES_SCENE.deepPurple.toString(16).padStart(6, '0')}/${SBNF_HUES_SCENE.lightPeach.toString(16).padStart(6, '0')}.png?text=Mirror&font=poppins`,
    dataAiHint: 'silhouette reflection webcam',
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      // Use OrthographicCamera for a 2D plane that fills the screen
      const camera = new THREE.OrthographicCamera(
        canvas.width / -2, canvas.width / 2,
        canvas.height / 2, canvas.height / -2,
        1, 1000
      );
      camera.position.z = 10; // Position camera

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

        const planeGeometry = new THREE.PlaneGeometry(1, 1); // Will be scaled to screen size
        
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
              // Clamp UVs to prevent potential issues with texture wrapping/mirroring at edges
              vec2 clampedUv = clamp(vUv, 0.0, 1.0);
              vec4 texColor = texture2D(webcamTexture, clampedUv);
              
              // Create a silhouette mask based on luminance
              float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
              float mask = smoothstep(0.3, 0.6, luma); // Adjust these thresholds for silhouette sensitivity
              
              // Apply dynamic color to the masked silhouette
              vec3 silhouetteColor = dynamicColorVec3 * mask; 
              
              // Output final color with opacity
              gl_FragColor = vec4(silhouetteColor, texColor.a * mask * opacityFactor);
            }
          `,
          transparent: true,
          depthWrite: false, // Important for correct alpha blending if other transparent objects are in scene
        });

        planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        planeMesh.scale.set(canvas.width, canvas.height, 1); // Scale plane to fill camera view
        scene.add(planeMesh);
        renderer.setClearColor(0x000000, 0); // Transparent background
      } else {
        // Fallback if webcam not ready: clear to a dark SBNF color
        const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 10); // Darker purple
        renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 1);
      }
      
      return { renderer, scene, camera, videoTexture, planeMesh, shaderMaterial };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.renderer) {
        // Ensure canvas is cleared if assets are not ready (e.g., webcam permission pending)
        if(renderer) {
          const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 10); 
          renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 1);
          renderer.clear(); // Explicitly clear
        }
        return;
      }
  
      const { videoTexture, planeMesh, shaderMaterial } = webGLAssets;
  
      if (settings.showWebcam && videoTexture && planeMesh && shaderMaterial && webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA && webcamElement.videoWidth > 0) {
          if (videoTexture.image !== webcamElement) { // Re-assign if webcam element changed
            videoTexture.image = webcamElement;
          }
          videoTexture.needsUpdate = true; // Request video texture update
          planeMesh.visible = true;
          renderer.setClearColor(0x000000, 0); // Ensure transparent background for the effect

          // Update mirror uniform
          if (shaderMaterial.uniforms.mirrorX_bool) {
              shaderMaterial.uniforms.mirrorX_bool.value = settings.mirrorWebcam;
          }

          // Update dynamic color based on audio
          const baseHue = SBNF_HUES_SCENE.lightLavender;
          const hueShift = (audioData.rms * 60 + audioData.trebleEnergy * 120 + performance.now() / 2000) % 360;
          const finalHue = (baseHue + hueShift) % 360;
          const saturation = 70 + audioData.midEnergy * 30;
          const lightness = 45 + audioData.rms * 30; // Make silhouette color more reactive to RMS
          const [r, g, b] = hslToRgb(finalHue, saturation, Math.min(80, lightness)); // Cap lightness

          if (shaderMaterial.uniforms.dynamicColorVec3) {
              shaderMaterial.uniforms.dynamicColorVec3.value.setRGB(r, g, b);
          }
          
          // Update opacity factor
          const baseOpacity = 0.75 + audioData.rms * 0.25; // More responsive opacity
          if (shaderMaterial.uniforms.opacityFactor) {
              shaderMaterial.uniforms.opacityFactor.value = Math.min(1.0, baseOpacity * settings.brightCap);
          }

          // Handle video aspect ratio ("cover" effect)
          const canvasAspect = canvasWidth / canvasHeight;
          const videoAspect = webcamElement.videoWidth / webcamElement.videoHeight;
          let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;

          if (canvasAspect > videoAspect) { // Canvas is wider than video
              scaleY = 1;
              scaleX = videoAspect / canvasAspect;
              offsetX = (1 - scaleX) / 2;
          } else { // Canvas is taller than video or same aspect
              scaleX = 1;
              scaleY = canvasAspect / videoAspect;
              offsetY = (1 - scaleY) / 2;
          }
          if (shaderMaterial.uniforms.textureScale) shaderMaterial.uniforms.textureScale.value.set(scaleX, scaleY);
          if (shaderMaterial.uniforms.textureOffset) shaderMaterial.uniforms.textureOffset.value.set(offsetX, offsetY);
          
          if (shaderMaterial) shaderMaterial.needsUpdate = true; // Request shader update if uniforms changed

      } else { 
          // If webcam is off or not ready, hide the plane and clear to background
          if (planeMesh) planeMesh.visible = false;
          const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.deepPurple, 56, 10); 
          renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 1);
          renderer.clear(); // Explicitly clear
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.videoTexture) webGLAssets.videoTexture.dispose();
        if (webGLAssets.planeMesh && webGLAssets.planeMesh.geometry) webGLAssets.planeMesh.geometry.dispose();
        if (webGLAssets.shaderMaterial) webGLAssets.shaderMaterial.dispose();
        // Renderer itself is managed by VisualizerView
      }
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    rendererType: 'webgl',
    thumbnailUrl: `https://placehold.co/120x80/${SBNF_HUES_SCENE.orangeRed.toString(16).padStart(6, '0')}/${SBNF_HUES_SCENE.lightPeach.toString(16).padStart(6, '0')}.png?text=Echoes&font=poppins`,
    dataAiHint: 'glowing orbs abstract shapes',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x000000, 0); // Transparent background initially

      // Pre-create geometries
      const circleGeometry = new THREE.CircleGeometry(1, 32); // Radius 1, 32 segments
      const planeGeometry = new THREE.PlaneGeometry(1, 1);
      const triSize = 0.7; // Base size for triangle
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
        }>, // Array to hold active shapes
        lastSpawnTime: 0,
        spawnInterval: 80, // ms, adjust for desired density
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.renderer || !webGLAssets.geometries || !webGLAssets.sbnfHues) return;
      const { activeShapes, geometries, sbnfHues, spawnInterval } = webGLAssets;
      const currentTime = performance.now();

      // Background clear with trail effect
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 5); // Slightly lighter black for less harsh contrast
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.15); // Low alpha for trails

      // Spawn new shapes
      const spawnThreshold = 0.10 + settings.gain * 0.03; // Adjusted for gain
      if ((audioData.beat || audioData.rms > spawnThreshold) && (currentTime - webGLAssets.lastSpawnTime > spawnInterval)) {
        if (activeShapes.length < 120) { // Max shapes on screen
          const shapeTypeIndex = Math.floor(Math.random() * geometries.length);
          const geometry = geometries[shapeTypeIndex];
          
          const material = new THREE.MeshBasicMaterial({
            // color will be set per instance
            transparent: true,
            depthWrite: false, // Important for blending
            opacity: 0, // Start invisible, fade in
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.x = (Math.random() - 0.5) * canvasWidth * 0.9;
          mesh.position.y = (Math.random() - 0.5) * canvasHeight * 0.9;
          mesh.position.z = Math.random() * -3 + 1; // Slight depth variation

          const baseScale = 20 + audioData.bassEnergy * 280 + Math.random() * 90;
          const initialScale = baseScale * settings.brightCap * (0.25 + audioData.midEnergy * 0.75);
          mesh.scale.set(0,0,0); // Start scaled down
          
          const rotationSpeed = (Math.random() - 0.5) * 0.035 * (1 + audioData.bpm/150);

          // Color logic
          const baseHue = sbnfHues[Math.floor(Math.random() * sbnfHues.length)];
          const hueShift = audioData.trebleEnergy * 100 + (audioData.beat ? 50 : 0) + currentTime / 1800; // Slow hue cycle
          const hue = (baseHue + hueShift) % 360;
          const saturation = 80 + Math.random() * 20 + audioData.midEnergy * 15;
          const lightness = 50 + audioData.rms * 35 + (audioData.beat ? 10 : 0);
          material.color.setHSL(hue / 360, Math.min(1, saturation / 100), Math.min(0.9, lightness / 100)); // Cap lightness
          
          const initialOpacity = (0.4 + audioData.rms * 0.6 + audioData.trebleEnergy * 0.4) * settings.brightCap;
          const life = 1200 + Math.random() * 1800; // Random lifetime 1.2s - 3s

          activeShapes.push({ mesh, creationTime: currentTime, life, initialScale, rotationSpeed, initialOpacity });
          scene.add(mesh);
          webGLAssets.lastSpawnTime = currentTime;
        }
      }

      // Animate existing shapes
      for (let i = activeShapes.length - 1; i >= 0; i--) {
        const shape = activeShapes[i];
        const age = currentTime - shape.creationTime;
        const lifeProgress = Math.min(1, age / shape.life);

        if (lifeProgress >= 1) {
          scene.remove(shape.mesh);
          shape.mesh.material.dispose(); // Dispose material
          // Geometry is shared, dispose in cleanupWebGL
          activeShapes.splice(i, 1);
        } else {
          // Fade in / out logic
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

          // Scale animation
          const growInDuration = shape.life * 0.3;
          let currentScaleFactor;
          if (age < growInDuration) {
            currentScaleFactor = (age / growInDuration); // Grow from 0 to 1
          } else {
            // Gentle pulsing after initial growth
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
        // Dispose of active shapes' materials
        if (webGLAssets.activeShapes) {
          webGLAssets.activeShapes.forEach((shape: any) => {
            if (shape.mesh) {
              if (webGLAssets.scene) webGLAssets.scene.remove(shape.mesh);
              if (shape.mesh.material) shape.mesh.material.dispose();
            }
          });
          webGLAssets.activeShapes = [];
        }
        // Dispose of shared geometries
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
    thumbnailUrl: `https://placehold.co/120x80/${SBNF_HUES_SCENE.orangeYellow.toString(16).padStart(6, '0')}/${SBNF_HUES_SCENE.deepPurple.toString(16).padStart(6, '0')}.png?text=Rings&font=poppins`,
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      const MAX_RINGS_PER_TYPE = 25; // Max rings for each frequency type
      const RING_LIFETIME_MS = 2800; // How long each ring lasts

      const ringGroups = [
        { type: 'bass', hue: SBNF_HUES_SCENE.orangeRed, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 120 },
        { type: 'mid', hue: SBNF_HUES_SCENE.orangeYellow, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 90 },
        { type: 'treble', hue: SBNF_HUES_SCENE.lightLavender, meshes: [] as THREE.Mesh[], lastSpawnTime: 0, spawnInterval: 70 }
      ];
      
      // Shared geometry for all rings
      const ringGeometry = new THREE.RingGeometry(0.97, 1, 64, 1, 0, Math.PI * 2); // Inner radius, outer radius, segments

      return {
        renderer, scene, camera, ringGroups, ringGeometry,
        MAX_RINGS_PER_TYPE, RING_LIFETIME_MS,
        maxVisualRadius: Math.min(canvas.width, canvas.height) * 0.50, // Rings expand to half the smaller canvas dimension
      };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.ringGroups || !webGLAssets.ringGeometry) return;
      const { ringGroups, ringGeometry, MAX_RINGS_PER_TYPE, RING_LIFETIME_MS, maxVisualRadius } = webGLAssets;
      const currentTime = performance.now();
      
      // Set background with trail effect
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 3); // Very dark
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.18); // Low alpha for trails

      ringGroups.forEach(group => {
        let energy = 0;
        if (group.type === 'bass') energy = audioData.bassEnergy;
        else if (group.type === 'mid') energy = audioData.midEnergy;
        else if (group.type === 'treble') energy = audioData.trebleEnergy;

        // Spawn new ring if energy threshold met, cooldown passed, and not too many rings
        const energyThreshold = group.type === 'bass' ? 0.1 : 0.08;
        if (energy > energyThreshold && currentTime - group.lastSpawnTime > group.spawnInterval / (1 + energy * 3) && group.meshes.length < MAX_RINGS_PER_TYPE) {
          const material = new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: false, // for correct alpha blending
            opacity: 0, // Start invisible
            side: THREE.DoubleSide
          });
          const ringMesh = new THREE.Mesh(ringGeometry, material);
          
          // Store creation time and initial energy on the mesh itself for animation
          (ringMesh.userData as any).creationTime = currentTime;
          (ringMesh.userData as any).initialEnergy = energy; // Store the energy at spawn time
          (ringMesh.userData as any).baseHue = group.hue;

          scene.add(ringMesh);
          group.meshes.push(ringMesh);
          group.lastSpawnTime = currentTime;
        }

        // Animate existing rings in this group
        for (let i = group.meshes.length - 1; i >= 0; i--) {
          const mesh = group.meshes[i];
          const meshUserData = mesh.userData as any;
          const age = currentTime - meshUserData.creationTime;
          const lifeProgress = age / RING_LIFETIME_MS;

          if (lifeProgress >= 1) {
            // Ring has lived its life
            scene.remove(mesh);
            (mesh.material as THREE.Material).dispose(); // Dispose material
            group.meshes.splice(i, 1);
            continue;
          }

          // Animate scale (radius)
          const currentRadius = lifeProgress * maxVisualRadius * (0.2 + meshUserData.initialEnergy * 0.8); // Scale based on initial energy
          mesh.scale.set(currentRadius, currentRadius, 1);

          // Animate opacity (fade in then out)
          const opacityFalloff = (1 - lifeProgress) * (1 - lifeProgress); // Stronger fade out
          const opacity = opacityFalloff * meshUserData.initialEnergy * settings.brightCap * 2.8 * (0.5 + audioData.rms * 0.5);
          (mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, opacity));
          
          // Animate color
          const hueShift = lifeProgress * 70 + (audioData.beat ? 35 : 0) + performance.now()/1800; // slow global hue cycle
          const hue = (meshUserData.baseHue + hueShift) % 360;
          const saturation = 90 + meshUserData.initialEnergy * 10;
          const lightness = 55 + meshUserData.initialEnergy * 30 + (audioData.beat ? 10 : 0); // Brighter on beat
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
    thumbnailUrl: `https://placehold.co/120x80/${SBNF_HUES_SCENE.lightLavender.toString(16).padStart(6, '0')}/${SBNF_HUES_SCENE.deepPurple.toString(16).padStart(6, '0')}.png?text=Grid&font=poppins`,
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      // Grid setup
      const GRID_SIZE_X = 20; // Number of cells horizontally
      const GRID_SIZE_Y = Math.floor(GRID_SIZE_X * (canvas.height / canvas.width)); // Maintain aspect ratio
      const CELL_COUNT = GRID_SIZE_X * GRID_SIZE_Y;
      const cellWidth = canvas.width / GRID_SIZE_X;
      const cellHeight = canvas.height / GRID_SIZE_Y;
      
      const cellGeometry = new THREE.PlaneGeometry(cellWidth * 0.85, cellHeight * 0.85); // Smaller cells with gaps
      const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });

      const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, CELL_COUNT);
      scene.add(instancedMesh);

      // Store target colors for smooth transitions
      const dummy = new THREE.Object3D();
      const cellStates = new Array(CELL_COUNT).fill(null).map(() => ({
        color: new THREE.Color(SBNF_HUES_SCENE.black), // Start black or very dim
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
      
      // Background clear with trail effect
      const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 2); // Very dark
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.25); // Low alpha for trails

      const spectrum = audioData.spectrum;
      const spectrumLength = spectrum.length;
      const beatFactor = audioData.beat ? 1.5 : 1.0; // Amplify effect on beat
      const time = performance.now() * 0.001; // For time-based variations

      for (let i = 0; i < CELL_COUNT; i++) {
        // Map cell to a spectrum bin, with a time-based offset for flowing patterns
        const spectrumIndex = Math.floor((i / CELL_COUNT) * spectrumLength + time * 5) % spectrumLength;
        const energy = spectrum[spectrumIndex] / 255;
        
        // Determine cell color
        const baseHue = sbnfHuesForGrid[(i + Math.floor(time * 2)) % sbnfHuesForGrid.length];
        const hue = (baseHue + energy * 60 + (audioData.beat ? 40 : 0)) % 360; // Shift hue with energy and beat
        const saturation = 80 + energy * 20;
        const lightness = Math.min(0.8, (0.1 + energy * 0.7 + audioData.rms * 0.2) * settings.brightCap * beatFactor);
        
        cellStates[i].targetColor.setHSL(hue / 360, saturation / 100, lightness);
        // Smoothly interpolate to target color
        cellStates[i].color.lerp(cellStates[i].targetColor, 0.15); // Adjust lerp factor for responsiveness
        instancedMesh.setColorAt(i, cellStates[i].color);
      }
      
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.instancedMesh) {
            if (webGLAssets.instancedMesh.geometry) webGLAssets.instancedMesh.geometry.dispose();
            if (webGLAssets.instancedMesh.material) (webGLAssets.instancedMesh.material as THREE.Material).dispose();
            // No need to remove from scene if scene itself is disposed by VisualizerView
        }
      }
    },
  },
  {
    id: 'spectrum_bars',
    name: 'Spectrum Bars',
    rendererType: '2d',
    thumbnailUrl: `https://placehold.co/120x80/${SBNF_HUES_SCENE.deepPurple.toString(16).padStart(6, '0')}/${SBNF_HUES_SCENE.orangeYellow.toString(16).padStart(6, '0')}.png?text=Bars&font=poppins`,
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
        const hue = (baseHue + normalizedValue * 50 + (audioData.beat ? 40 : 0) + performance.now() / 1200) % 360; // Faster hue cycle for SBNF
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
    thumbnailUrl: `https://placehold.co/120x80/${SBNF_HUES_SCENE.orangeRed.toString(16).padStart(6, '0')}/000000.png?text=Burst&font=poppins`,
    dataAiHint: 'abstract explosion particles',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 100;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);

      const MAX_PARTICLES = 8000;
      const positions = new Float32Array(MAX_PARTICLES * 3);
      const colors = new Float32Array(MAX_PARTICLES * 3);
      const velocities = new Float32Array(MAX_PARTICLES * 3); 
      const lifetimes = new Float32Array(MAX_PARTICLES); 

      const sbnfHuesForBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
      const tempColor = new THREE.Color();

      for (let i = 0; i < MAX_PARTICLES; i++) {
        lifetimes[i] = 0; // Dead initially
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 2.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
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
      renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.10); // SBNF Black with shorter trails

      material.size = (1.5 + audioData.rms * 5 + settings.brightCap * 2);
      material.opacity = Math.min(1, 0.4 + audioData.rms * 0.6 + settings.brightCap * 0.2); // Slightly less base opacity

      const beatBurstCooldown = 100; // ms
      const ambientSpawnRate = 50 + audioData.rms * 200; // particles per second
      const ambientSpawnInterval = 1000 / ambientSpawnRate;

      let particlesToSpawnOnBeat = 0;
      if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatBurstCooldown)) {
        particlesToSpawnOnBeat = Math.floor(MAX_PARTICLES * (0.15 + audioData.bassEnergy * 0.5)); // Spawn 15-65% of particles
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

        if (lifetimes[i] <= 0) { 
          let spawn = false;
          let life = 0.8 + Math.random() * 1.2; 
          let speed = 0;
          let baseHue;

          if (particlesToSpawnOnBeat > 0) {
            spawn = true;
            particlesToSpawnOnBeat--;
            speed = 60 + Math.random() * 120 * (audioData.bassEnergy + 0.3) * (audioData.rms + 0.1); // Increased speed factor
            baseHue = sbnfHues[i % 2 === 0 ? 0 : 1]; // OrangeRed or OrangeYellow for bursts
            life *= 0.6; 
          } else if (particlesToSpawnAmbient > 0 && audioData.rms > 0.015) {
            spawn = true;
            particlesToSpawnAmbient--;
            speed = 15 + Math.random() * 35 * (audioData.midEnergy + audioData.trebleEnergy + 0.1);
            baseHue = sbnfHues[i % 2 === 0 ? 2 : 3]; // Lavender or LightPeach for ambient
          }

          if (spawn) {
            lifetimes[i] = life;
            positions[i3] = (Math.random() - 0.5) * 0.05; // Start very close to center
            positions[i3 + 1] = (Math.random() - 0.5) * 0.05;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.05;

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
            velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
            velocities[i3 + 2] = speed * Math.cos(phi);

            const hueShift = audioData.bassEnergy * 30; // More hue shift from bass for SBNF
            const colorHue = (baseHue + hueShift + (Math.random() * 40 - 20)) % 360;
            const colorSaturation = 0.85 + Math.random() * 0.15;
            const colorLightness = 0.65 + Math.random() * 0.2 + audioData.rms * 0.15;
            tempColor.setHSL(colorHue / 360, colorSaturation, Math.min(0.85, colorLightness)); // Cap lightness
            colors[i3] = tempColor.r;
            colors[i3 + 1] = tempColor.g;
            colors[i3 + 2] = tempColor.b;
          }
        }

        if (lifetimes[i] > 0) {
          positions[i3] += velocities[i3] * deltaTime;
          positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
          positions[i3 + 2] += velocities[i3 + 2] * deltaTime;
          
          velocities[i3] *= 0.975; // Slightly more drag
          velocities[i3 + 1] *= 0.975;
          velocities[i3 + 2] *= 0.975;
          
          const fadeProgress = Math.max(0, lifetimes[i] / (0.8 + Math.random()*1.2)); // Base lifetime
          const originalLuminance = (new THREE.Color(colors[i3], colors[i3+1], colors[i3+2])).getHSL({h:0,s:0,l:0}).l;
          tempColor.setRGB(colors[i3], colors[i3+1], colors[i3+2]).multiplyScalar(fadeProgress * fadeProgress); // Faster fade out
          colors[i3] = tempColor.r;
          colors[i3+1] = tempColor.g;
          colors[i3+2] = tempColor.b;

        } else { 
            positions[i3] = positions[i3 + 1] = positions[i3 + 2] = 10000; // Move off-screen
            colors[i3] = colors[i3 + 1] = colors[i3 + 2] = 0;
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
    thumbnailUrl: `https://placehold.co/120x80/${SBNF_HUES_SCENE.deepPurple.toString(16).padStart(6, '0')}/${SBNF_HUES_SCENE.orangeRed.toString(16).padStart(6, '0')}.png?text=Tunnel&font=poppins`,
    dataAiHint: 'geometric tunnel flight tron',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 10; 

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(SBNF_HUES_SCENE.black, 1); // Use SBNF black
      
      const numSegments = 25;
      const segmentSpacing = 12; 
      const tunnelLength = numSegments * segmentSpacing;
      const segments: THREE.Mesh[] = [];
      
      const geometry = new THREE.TorusGeometry(18, 0.2, 8, 50); // Thinner torus for Tron lines
      const sbnfHuesForTunnel = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.orangeYellow];

      for (let i = 0; i < numSegments; i++) {
        // const [r,g,bVal] = hslToRgb(sbnfHuesForTunnel[i % sbnfHuesForTunnel.length], 100, 60); 
        const material = new THREE.MeshBasicMaterial({ 
          wireframe: true, // Key for Tron look
          // color will be set dynamically
          transparent: true,
          opacity: 0.75 
        }); 
        const segment = new THREE.Mesh(geometry, material);
        segment.position.z = -i * segmentSpacing;
        segment.rotation.x = Math.PI / 2; // Orient rings correctly
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

      const travelSpeedBase = 25 + audioData.bpm * 0.12; // Base speed related to BPM
      const travelSpeed = (travelSpeedBase + audioData.rms * 60) * deltaTime; // Add RMS boost
      camera.position.z -= travelSpeed;

      const tempColor = new THREE.Color();

      segments.forEach((segment, i) => {
        // Recycle segments that move behind the camera
        if (segment.position.z > camera.position.z + segmentSpacing) { // A bit of margin
          segment.position.z -= tunnelLength; // Move to the front of the tunnel
        }

        // Scale segments based on audio and a sine wave for pulsing effect
        const scaleFactorBase = 0.8 + Math.sin(currentTime * 0.0015 + i * 0.4) * 0.15; // Base gentle pulse
        const scaleFactorAudio = audioData.bassEnergy * 0.6 + (audioData.beat ? 0.35 : 0); // Audio reactive scale
        segment.scale.setScalar(Math.max(0.35, scaleFactorBase + scaleFactorAudio * settings.brightCap));

        // Color segments - Tron blue with orange/red highlights on beat
        let targetHue;
        if (audioData.beat && (i % 3 === 0)) { // Every 3rd segment flashes orange/red on beat
            targetHue = SBNF_HUES_SCENE.orangeRed;
        } else {
            targetHue = (SBNF_HUES_SCENE.tronBlue + audioData.trebleEnergy * 60 + currentTime / 2000) % 360; // Base Tron blue, shifts with treble/time
        }
        
        const lightness = 0.55 + audioData.rms * 0.4 + (audioData.beat ? 0.30 : 0) + settings.brightCap * 0.1; // Reactive lightness
        const [r,g,bVal] = hslToRgb(targetHue, 98, Math.min(0.85, lightness)); // High saturation for Tron glow
        tempColor.setRGB(r,g,bVal);
        
        if (segment.material instanceof THREE.MeshBasicMaterial) {
            segment.material.color = tempColor;
            segment.material.opacity = Math.min(0.95, 0.65 + audioData.rms * 0.35 + settings.brightCap * 0.2);
        }
        
        // Rotate segments for more dynamism
        segment.rotation.z += (audioData.trebleEnergy * 0.025 + 0.001 + audioData.bpm * 0.00002) * (i % 2 === 0 ? 1.2 : -1.4) * deltaTime * 60; // Different rotation per segment
        segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0006 + i * 0.35) * audioData.midEnergy * 0.6; // Wobble
      });

      // Camera FOV effect for speed/warping
      camera.fov = cameraBaseFov - audioData.rms * 35 * settings.gamma + (audioData.beat ? 8 : 0) ; // Zoom in/out with RMS/beat
      camera.fov = Math.max(35, Math.min(105, camera.fov)); // Clamp FOV
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
    thumbnailUrl: `https://placehold.co/120x80/${SBNF_HUES_SCENE.lightPeach.toString(16).padStart(6, '0')}/000000.png?text=Strobe&font=poppins`,
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
    thumbnailUrl: `https://placehold.co/120x80/${SBNF_HUES_SCENE.orangeRed.toString(16).padStart(6, '0')}/000000.png?text=Finale&font=poppins`,
    dataAiHint: 'grand particle explosion fireworks',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        camera.position.z = 50; 

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        const PARTICLE_COUNT = 3000; // Adjusted count
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const colors = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);
        const lifetimes = new Float32Array(PARTICLE_COUNT); // current lifetime

        const sbnfHuesForFinale = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.deepPurple];
        const tempColor = new THREE.Color();

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            lifetimes[i] = 0; // Initialize all particles as "dead"
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 0.3, // Adjusted base size
            vertexColors: true,
            transparent: true,
            opacity: 0.65, 
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);
        
        return {
            renderer, scene, camera, particles, particleMaterial, particleGeometry,
            sbnfHues: sbnfHuesForFinale, velocities, lifetimes, PARTICLE_COUNT,
            lastBeatTime: 0, lastFrameTime: performance.now(),
            cameraBaseZ: camera.position.z,
            initialParticleLifetime: 2.5, // seconds
        };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.velocities || !webGLAssets.particleGeometry || !webGLAssets.sbnfHues || typeof webGLAssets.cameraBaseZ === 'undefined') return;

        const { particles, particleMaterial, particleGeometry, sbnfHues, velocities, lifetimes, PARTICLE_COUNT, cameraBaseZ, initialParticleLifetime } = webGLAssets;
        const positionsAttribute = particleGeometry.attributes.position as THREE.BufferAttribute;
        const colorsAttribute = particleGeometry.attributes.color as THREE.BufferAttribute;

        const currentTime = performance.now();
        const deltaTime = Math.min(0.05, (currentTime - (webGLAssets.lastFrameTime || currentTime)) / 1000.0);
        webGLAssets.lastFrameTime = currentTime;

        const [bgR, bgG, bgB] = hslToRgb(SBNF_HUES_SCENE.black, 0, 2); // Darker SBNF Black
        renderer.setClearColor(new THREE.Color(bgR, bgG, bgB), 0.20); // Slightly faster fade for trails

        const effectiveBrightCap = Math.max(0.1, settings.brightCap);
        particleMaterial.opacity = Math.min(0.75, effectiveBrightCap * 0.7 * (0.4 + audioData.rms * 0.5)); // Adjusted opacity
        particleMaterial.size = Math.max(0.15, (0.2 + effectiveBrightCap * (audioData.rms * 1.5 + audioData.bassEnergy * 1.0 + audioData.trebleEnergy * 0.8)));

        const tempColor = new THREE.Color();
        const dragFactor = 0.98; 
        const beatRefractoryPeriod = 80; // ms between beat bursts

        if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatRefractoryPeriod)) {
            webGLAssets.lastBeatTime = currentTime;
            const burstStrength = 25.0 + audioData.bassEnergy * 50.0 + audioData.rms * 35.0; 
            let particlesSpawnedThisBeat = 0;
            const maxParticlesPerBeat = PARTICLE_COUNT * 0.6; // Spawn up to 60% of particles on a strong beat

            for (let i = 0; i < PARTICLE_COUNT && particlesSpawnedThisBeat < maxParticlesPerBeat; i++) {
                if (lifetimes[i] <= 0) { // Find a "dead" particle to re-spawn
                    const i3 = i * 3;
                    lifetimes[i] = initialParticleLifetime * (0.7 + Math.random() * 0.6); // Vary lifetime
                    
                    positionsAttribute.array[i3] = (Math.random() - 0.5) * 0.1; 
                    positionsAttribute.array[i3 + 1] = (Math.random() - 0.5) * 0.1;
                    positionsAttribute.array[i3 + 2] = (Math.random() - 0.5) * 0.1;

                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const speed = (0.5 + Math.random() * 0.5) * burstStrength; 

                    velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[i3 + 2] = speed * Math.cos(phi);

                    const burstHueIndex = (i + Math.floor(currentTime / 15)) % sbnfHues.length; 
                    const hueLightness = 0.5 + Math.random() * 0.2 + audioData.trebleEnergy * 0.1; // Slightly less max lightness
                    tempColor.setHSL(sbnfHues[burstHueIndex] / 360, 1.0, Math.min(0.8, hueLightness)); 
                    colorsAttribute.array[i3] = tempColor.r;
                    colorsAttribute.array[i3 + 1] = tempColor.g;
                    colorsAttribute.array[i3 + 2] = tempColor.b;
                    particlesSpawnedThisBeat++;
                }
            }
        }

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (lifetimes[i] > 0) {
                const i3 = i * 3;
                lifetimes[i] -= deltaTime;

                if (lifetimes[i] <= 0) {
                    positionsAttribute.array[i3] = 10000; // Move off-screen when dead
                    velocities[i3] = velocities[i3+1] = velocities[i3+2] = 0;
                } else {
                    positionsAttribute.array[i3] += velocities[i3] * deltaTime;
                    positionsAttribute.array[i3 + 1] += velocities[i3 + 1] * deltaTime;
                    positionsAttribute.array[i3 + 2] += velocities[i3 + 2] * deltaTime;

                    velocities[i3] *= dragFactor;
                    velocities[i3 + 1] *= dragFactor;
                    velocities[i3 + 2] *= dragFactor;
                    
                    // Fade color (alpha via darkening)
                    const fade = Math.pow(lifetimes[i] / (initialParticleLifetime * (0.7 + Math.random() * 0.6)), 2); // Quadratic fade
                    colorsAttribute.array[i3] *= fade;
                    colorsAttribute.array[i3 + 1] *= fade;
                    colorsAttribute.array[i3 + 2] *= fade;
                }
            }
        }

        positionsAttribute.needsUpdate = true;
        colorsAttribute.needsUpdate = true;
        
        particles.rotation.y += 0.0010 * (1 + audioData.trebleEnergy * 2.5); 
        particles.rotation.x += 0.0007 * (1 + audioData.midEnergy * 2.5);
        camera.position.z = cameraBaseZ - audioData.rms * 20; // More subtle camera zoom
        camera.lookAt(scene.position);
    },
    cleanupWebGL: (webGLAssets) => {
        if (webGLAssets) {
            if (webGLAssets.particleGeometry) webGLAssets.particleGeometry.dispose();
            if (webGLAssets.particleMaterial) webGLAssets.particleMaterial.dispose();
        }
    },
  },
];


export const CONTROL_PANEL_WIDTH_STRING = "280px";

