
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
    // Simple pseudo-random noise, not true Perlin
    const stride = i * 4;
    const value = Math.floor(Math.random() * 155) + 100; // Brighter noise
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
  currentSceneId: 'radial_burst', // SBNF "Cosmic Grapevines" default
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
  aiOverlayPrompt: "Afrofuturistic cosmic vine with glowing purple grapes, starry nebula background, high contrast, transparent", // SBNF themed
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
      // console.log('[MirrorSilhouette] initWebGL called. WebcamElement:', webcamElement ? 'present' : 'null');
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10; 

      const webGLAssets: Partial<WebGLSceneAssets> & { lastCanvasWidth?: number, lastCanvasHeight?: number, vinesData?: any, GRAPE_COUNT?: number, lastGrapeSpawnTime?: number } = {
        scene,
        camera,
        lastCanvasWidth: 0,
        lastCanvasHeight: 0,
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 15%)`), 
        noiseTexture: generateNoiseTexture(256, 256),
        vinesData: { activeVines: [], nextVineId: 0, lastSpawnTime: 0, spawnCooldown: 200, maxVines: 15 },
        GRAPE_COUNT: 200,
        lastGrapeSpawnTime: 0,
        tempColor: new THREE.Color(),
        lastFrameTimeWebGL: performance.now(),
      };
      
      if (webcamElement && webcamElement.readyState >= webcamElement.HAVE_METADATA && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0) {
        // console.log('[MirrorSilhouette] Webcam ready, creating texture and plane.');
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

          float fresnel(vec3 viewDir, vec3 normal) {
            return pow(1.0 - clamp(dot(normalize(viewDir), normalize(normal)), 0.0, 1.0), 3.0);
          }

          void main() {
            if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard;

            vec2 noiseUv = vUv * 2.0 + vec2(u_time * 0.05, u_time * 0.03); 

            vec4 webcamColor = texture2D(u_webcamTexture, vUv);
            float luma = dot(webcamColor.rgb, vec3(0.299, 0.587, 0.114));
            float silhouetteMask = smoothstep(0.3, 0.6, luma); 

            float fresnelEffect = fresnel(vec3(0.0, 0.0, 1.0), vec3(0.0, 0.0, 1.0)); 
            fresnelEffect = smoothstep(0.4, 1.0, fresnelEffect); 

            vec3 noiseVal = texture2D(u_noiseTexture, noiseUv).rgb;
            vec3 fillColor = mix(u_fillColor1, u_fillColor2, noiseVal.r); 

            vec3 finalColor = vec3(0.0);
            float finalAlpha = 0.0;

            if (silhouetteMask > 0.1) { 
              finalColor = mix(fillColor, u_rimColor, fresnelEffect * 0.7); 
              finalAlpha = silhouetteMask * u_opacityFactor * 1.8; 
            } else { 
              finalColor = u_rimColor; 
              finalAlpha = fresnelEffect * u_opacityFactor * 0.5 * 1.8; 
            }
            
            finalColor *= u_opacityFactor; // Apply overall opacity from JS
            
            gl_FragColor = vec4(finalColor, clamp(finalAlpha, 0.0, 1.0));
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
          depthWrite: false,
        });
        webGLAssets.shaderMaterial = shaderMaterial;
        const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
        scene.add(planeMesh);
        webGLAssets.planeMesh = planeMesh;

        // Grape particles setup
        const GRAPE_COUNT = 200;
        webGLAssets.GRAPE_COUNT = GRAPE_COUNT;
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
          size: 1.0, // Base size to be multiplied by attribute
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true, // Allows per-particle size via attribute if shader is set up
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
        // console.log('[MirrorSilhouette] Webcam not ready for initWebGL.');
      }
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, webcamElement, canvasWidth, canvasHeight }) => {
      if (!renderer || !scene || !camera || !webGLAssets) {
        if(renderer && webGLAssets?.bgColor) renderer.setClearColor(webGLAssets.bgColor.getHex(), 1.0);
        return;
      }
      
      const { planeMesh, shaderMaterial, videoTexture, bgColor, noiseTexture,
              grapes, grapeGeometry, grapeMaterial, grapePositions, grapeColors, grapeTargetSizes, grapeCurrentSizes,
              grapeLifetimes, grapeSpawnTimes, GRAPE_COUNT, tempColor, vinesData
       } = webGLAssets as any;

      const currentTime = performance.now();
      const deltaTime = (currentTime - (webGLAssets.lastFrameTimeWebGL || currentTime-16)) / 1000.0;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      if (shaderMaterial) {
        shaderMaterial.uniforms.u_time.value = currentTime * 0.001;
        if (shaderMaterial.uniforms.u_resolution) shaderMaterial.uniforms.u_resolution.value.set(canvasWidth, canvasHeight);
      }


      if (planeMesh && shaderMaterial && videoTexture && settings.showWebcam && webcamElement && webcamElement.readyState >= webcamElement.HAVE_ENOUGH_DATA) {
        renderer.setClearAlpha(0.15); 
        renderer.setClearColor(bgColor ? bgColor.getHex() : 0x000000, renderer.getClearAlpha());
        
        if(videoTexture.image !== webcamElement) videoTexture.image = webcamElement;
        videoTexture.needsUpdate = true;
        shaderMaterial.uniforms.u_mirrorX.value = settings.mirrorWebcam;
        
        const baseOpacity = settings.brightCap * (0.5 + audioData.rms * 0.7); 
        shaderMaterial.uniforms.u_opacityFactor.value = Math.min(1.0, baseOpacity * 1.5);


        const hueTimeShift = (currentTime / 20000) * 360;
        const rimBaseHue = (SBNF_HUES_SCENE.orangeYellow + audioData.trebleEnergy * 60 + hueTimeShift) % 360;
        shaderMaterial.uniforms.u_rimColor.value.setHSL(rimBaseHue / 360, 0.9, 0.55 + audioData.beat * 0.2);

        const fill1BaseHue = (SBNF_HUES_SCENE.deepPurple + audioData.bassEnergy * 50 + hueTimeShift * 0.7) % 360;
        shaderMaterial.uniforms.u_fillColor1.value.setHSL(fill1BaseHue / 360, 0.6, 0.2 + audioData.midEnergy * 0.2);
        
        const fill2BaseHue = (SBNF_HUES_SCENE.lightLavender + audioData.midEnergy * 70 + hueTimeShift * 1.3) % 360;
        shaderMaterial.uniforms.u_fillColor2.value.setHSL(fill2BaseHue / 360, 0.7, 0.35 + audioData.trebleEnergy * 0.25);


        if (webGLAssets.lastCanvasWidth !== canvasWidth || webGLAssets.lastCanvasHeight !== canvasHeight) {
          if (planeMesh.geometry) planeMesh.geometry.dispose();
          planeMesh.geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
          webGLAssets.lastCanvasWidth = canvasWidth;
          webGLAssets.lastCanvasHeight = canvasHeight;
        }
        planeMesh.visible = true;
      } else {
        if (planeMesh) planeMesh.visible = false;
        renderer.setClearColor(bgColor ? bgColor.getHex() : 0x100520, 1);
      }

      // Grape particles logic
      if (grapes && grapeLifetimes && grapePositions && grapeColors && grapeCurrentSizes && grapeTargetSizes && grapeSpawnTimes && tempColor && GRAPE_COUNT) {
        const beatCooldown = 150; 
        let spawnedThisFrameGrapes = 0;
        const maxSpawnPerBeatGrapes = GRAPE_COUNT * 0.15; 

        if (audioData.beat && (currentTime - (webGLAssets.lastGrapeSpawnTime || 0) > beatCooldown) && spawnedThisFrameGrapes < maxSpawnPerBeatGrapes) {
            webGLAssets.lastGrapeSpawnTime = currentTime;
            let grapesToSpawnCount = Math.floor(GRAPE_COUNT * (0.05 + audioData.bassEnergy * 0.2));
            grapesToSpawnCount = Math.min(grapesToSpawnCount, GRAPE_COUNT); 

            for (let i = 0; i < GRAPE_COUNT && spawnedThisFrameGrapes < grapesToSpawnCount; i++) {
                if (grapeLifetimes[i] <= 0) { 
                    const pIdx = i * 3;
                    grapePositions[pIdx] = (Math.random() - 0.5) * canvasWidth * 0.7;
                    grapePositions[pIdx + 1] = (Math.random() - 0.5) * canvasHeight * 0.7;
                    grapePositions[pIdx + 2] = (Math.random() - 0.5) * 50; 

                    grapeLifetimes[i] = 1.5 + Math.random() * 1.5; 
                    grapeSpawnTimes[i] = currentTime;
                    
                    const initialColorHue = SBNF_HUES_SCENE.lightLavender;
                    const [r,g,b] = hslToRgb(initialColorHue, 80 + Math.random()*20, 60 + Math.random()*10);
                    tempColor.setRGB(r,g,b);
                    grapeColors[pIdx] = tempColor.r;
                    grapeColors[pIdx + 1] = tempColor.g;
                    grapeColors[pIdx + 2] = tempColor.b;
                    
                    grapeTargetSizes[i] = 15 + audioData.bassEnergy * 40 + Math.random() * 10; 
                    grapeCurrentSizes[i] = 0.1; 
                    spawnedThisFrameGrapes++;
                }
            }
        }

        let activeGrapes = 0;
        for (let i = 0; i < GRAPE_COUNT; i++) {
            if (grapeLifetimes[i] > 0) {
                activeGrapes++;
                const pIdx = i * 3;
                grapeLifetimes[i] -= deltaTime;
                
                const age = (currentTime - grapeSpawnTimes[i]); // Age in ms
                const initialLifetimeMs = (grapeLifetimes[i] * 1000) + age + (deltaTime * 1000); // Estimate initial
                const lifeRatio = Math.max(0, Math.min(1, age / initialLifetimeMs )); 

                const startHue = SBNF_HUES_SCENE.lightLavender;
                const endHue = SBNF_HUES_SCENE.orangeRed;
                const currentHue = startHue + (endHue - startHue) * lifeRatio;
                const currentLightness = 60 + (45 - 60) * lifeRatio; 
                const [r,g,b] = hslToRgb(currentHue, 90, currentLightness);
                tempColor.setRGB(r,g,b);
                grapeColors[pIdx] = tempColor.r;
                grapeColors[pIdx + 1] = tempColor.g;
                grapeColors[pIdx + 2] = tempColor.b;

                const popDurationMs = 300; 
                if (age < popDurationMs) {
                    grapeCurrentSizes[i] = (age / popDurationMs) * grapeTargetSizes[i];
                } else {
                    const fadeLifeRatio = Math.max(0, grapeLifetimes[i] / (initialLifetimeMs/1000 - popDurationMs/1000 + 0.01) );
                    grapeCurrentSizes[i] = grapeTargetSizes[i] * Math.pow(fadeLifeRatio, 2); // Fade size quadratically
                }
                grapeCurrentSizes[i] = Math.max(0.1, grapeCurrentSizes[i] * settings.brightCap);


                if (grapeLifetimes[i] <= 0) {
                    grapeCurrentSizes[i] = 0; 
                    grapePositions[pIdx + 1] = -canvasHeight * 2; 
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
          grapeMaterial.size = 1.0; // Base size factor for shader if size attribute is used
          grapeMaterial.needsUpdate = true;
        }

      }

      // Procedural Vines (data updated here, drawn on overlay canvas)
      if (vinesData) {
        const { activeVines, spawnCooldown, maxVines } = vinesData;
        if (audioData.midEnergy > 0.35 && currentTime - (vinesData.lastSpawnTime || 0) > spawnCooldown && activeVines.length < maxVines) {
          vinesData.lastSpawnTime = currentTime;
          vinesData.nextVineId = (vinesData.nextVineId || 0) + 1;
          const newVine: ProceduralVine = {
            id: vinesData.nextVineId,
            points: [],
            color: `hsla(${(SBNF_HUES_SCENE.lightLavender + Math.random() * 60 - 30)%360}, 70%, 65%, 0.7)`,
            opacity: 0.7,
            currentLength: 0,
            maxLength: 150 + Math.random() * 150, // pixels
            spawnTime: currentTime,
            lifetime: 2000 + Math.random() * 2000, // ms
            thickness: 1 + audioData.midEnergy * 2,
            curlFactor: 0.03 + Math.random() * 0.04,
            angle: Math.random() * Math.PI * 2,
            startX: Math.random() < 0.5 ? (Math.random() < 0.5 ? 0 : canvasWidth) : Math.random() * canvasWidth,
            startY: Math.random() < 0.5 ? (Math.random() < 0.5 ? 0 : canvasHeight) : Math.random() * canvasHeight,
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
            const noiseAngle = (Math.sin(currentTime * 0.0005 * vine.curlFactor + vine.id + vine.points.length * 0.1)) * Math.PI * 0.25 * (0.5 + audioData.trebleEnergy);
            vine.angle += noiseAngle * (deltaTime * 50); 

            const segmentLength = vine.speed * 1.5; 
            const nextX = lastPoint.x + Math.cos(vine.angle) * segmentLength;
            const nextY = lastPoint.y + Math.sin(vine.angle) * segmentLength;
            
            const boundedX = Math.max(0, Math.min(canvasWidth, nextX));
            const boundedY = Math.max(0, Math.min(canvasHeight, nextY));
            if (nextX !== boundedX || nextY !== boundedY) { 
                vine.angle += Math.PI + (Math.random() - 0.5) * Math.PI * 0.5; 
            }

            vine.points.push({ x: boundedX, y: boundedY });
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

        if (webGLAssets.vinesData) webGLAssets.vinesData.activeVines = [];
      }
    },
  },
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    rendererType: 'webgl', // Changed to webgl
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/FFECDA.png?text=Echoes&font=poppins',
    dataAiHint: 'glowing orbs abstract shapes',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 10;

      const circleGeom = new THREE.CircleGeometry(0.5, 32); // Radius 0.5, scaled up later
      const squareGeom = new THREE.PlaneGeometry(1, 1); // 1x1, scaled up later
      const triangleShape = new THREE.Shape();
      triangleShape.moveTo(0, 0.5);
      triangleShape.lineTo(0.5 * Math.cos(Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(Math.PI / 6 + Math.PI / 2));
      triangleShape.lineTo(0.5 * Math.cos(5 * Math.PI / 6 + Math.PI / 2), -0.5 * Math.sin(5 * Math.PI / 6 + Math.PI / 2));
      triangleShape.closePath();
      const triangleGeom = new THREE.ShapeGeometry(triangleShape);
      triangleGeom.center();


      return {
        scene, camera,
        geometries: [circleGeom, squareGeom, triangleGeom],
        activeShapes: [], lastSpawnTime: 0,
        spawnInterval: 100, shapeBaseLifetime: 2500,
        lastFrameTime: performance.now(), tempColor: new THREE.Color(),
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`),
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
      const deltaTime = (currentTime - webGLAssets.lastFrameTime);
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearAlpha(0.05); // Trail effect
      renderer.setClearColor(bgColor.getHex(), renderer.getClearAlpha());
      
      const currentSpawnIntervalSetting = (webGLAssets as any).spawnInterval;
      const effectiveSpawnInterval = currentSpawnIntervalSetting / (1 + audioData.rms * 2);
      const spawnCondition = audioData.beat || (audioData.rms > 0.02 && currentTime - (webGLAssets as any).lastSpawnTime > effectiveSpawnInterval);

      if (spawnCondition && activeShapes.length < 50) { // Max 50 shapes
        (webGLAssets as any).lastSpawnTime = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 1.0 + audioData.bassEnergy * 0.5 + (audioData.beat ? 1: 0));

        for (let k = 0; k < numToSpawn; k++) {
          const geom = geometries[Math.floor(Math.random() * geometries.length)];
          const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geom, material);
          const sizeBase = (15 + audioData.bassEnergy * 80 + Math.random() * 30); // Base size in pixels
          const initialScale = sizeBase * Math.max(0.1, settings.brightCap) * (0.3 + audioData.midEnergy * 0.5);
          if (initialScale < 5) continue;

          mesh.position.set((Math.random() - 0.5) * canvasWidth * 0.85, (Math.random() - 0.5) * canvasHeight * 0.85, 0);
          // The geometries are unit size, so scale directly sets pixel size
          mesh.scale.set(initialScale * 0.1, initialScale * 0.1, 1); // Initial scale for pop-in

          const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];
          const baseObjectHue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
          const spectrumVal = (audioData.spectrum[k*5 % audioData.spectrum.length] || 0) / 255;
          const hue = (baseObjectHue + spectrumVal * 40 + (audioData.beat ? 30:0) + performance.now()/400) % 360;
          const [r,g,bVal] = hslToRgb(hue, 85 + Math.random()*15, 50 + Math.random()*20);
          material.color.setRGB(r,g,bVal);
          
          const lifetime = shapeBaseLifetime * (0.6 + Math.random() * 0.6);
          const growInDuration = 250 + Math.random() * 100;
          activeShapes.push({ mesh, spawnTime: currentTime, lifetime, initialScale, rotationSpeed: (Math.random() - 0.5) * 0.0025 * (1 + audioData.trebleEnergy), growInDuration });
          scene.add(mesh);
        }
      }

      for (let i = activeShapes.length - 1; i >= 0; i--) {
        const shape = activeShapes[i];
        const age = currentTime - shape.spawnTime;
        if (age > shape.lifetime) {
          scene.remove(shape.mesh); 
          shape.mesh.material.dispose(); 
          // No need to dispose shared geometries here, they are disposed in cleanupWebGL
          activeShapes.splice(i, 1); 
          continue;
        }

        const lifeProgress = age / shape.lifetime;
        const growInPhase = Math.min(1.0, age / shape.growInDuration);
        
        let currentScaleFactor = growInPhase; // Grow-in phase
        if (age > shape.growInDuration) { // After grow-in, apply subtle pulse
            currentScaleFactor = 1 + Math.sin((age - shape.growInDuration) * 0.002 * (1 + audioData.midEnergy * 1.2)) * 0.15;
        }
        
        const finalScale = shape.initialScale * currentScaleFactor;
        shape.mesh.scale.set(finalScale, finalScale, finalScale);
        
        const targetOpacity = (0.25 + audioData.trebleEnergy * 0.35 + audioData.rms * 0.35) * settings.brightCap * 1.0;
        shape.mesh.material.opacity = Math.min(1, Math.max(0, (1.0 - lifeProgress) * targetOpacity * growInPhase));
        
        shape.mesh.rotation.z += shape.rotationSpeed * deltaTime * 0.06; // deltaTime adjustment
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets) {
        if (webGLAssets.activeShapes) {
          (webGLAssets.activeShapes as any[]).forEach(shape => { 
            if (webGLAssets.scene) (webGLAssets.scene as THREE.Scene).remove(shape.mesh); 
            if (shape.mesh.material) (shape.mesh.material as THREE.Material).dispose(); 
            // Geometries are shared, dispose them once
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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/000000.png?text=Rings&font=poppins', // SBNF Orange-Yellow on Black
    dataAiHint: 'frequency audio rings',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;
        
        const ringGeometry = new THREE.RingGeometry(0.98, 1, 64); // Shared geometry, radius 1, thickness 0.02

        return {
            scene, camera, activeRings: [], ringGeometry,
            lastSpawnTimes: [0,0,0], // For bass, mid, treble respectively
            tempColor: new THREE.Color(),
            bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`),
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

        renderer.setClearAlpha(0.08); 
        renderer.setClearColor(bgColor.getHex(), renderer.getClearAlpha());

        const energies = [audioData.bassEnergy, audioData.midEnergy, audioData.trebleEnergy];
        const baseHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender];
        const spawnIntervals = [120, 100, 80]; // ms
        const maxRingRadius = Math.min(canvasWidth, canvasHeight) * 0.45;

        energies.forEach((energy, i) => {
            const effectiveEnergy = Math.max(0.02, energy); 
            if (energy > 0.04 && currentTime - lastSpawnTimes[i] > spawnIntervals[i] / (effectiveEnergy * 5 + 0.2)) {
                lastSpawnTimes[i] = currentTime;
                const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, opacity: 0 });
                const ringMesh = new THREE.Mesh(ringGeometry, material);
                
                const spectrumVal = (audioData.spectrum[i * 10 % audioData.spectrum.length] || 0) / 255;
                const hue = (baseHues[i] + spectrumVal * 40 + (audioData.beat ? 25 : 0) + performance.now()/500) % 360;
                const [r,g,bVal] = hslToRgb(hue, 90 + energy*10, 50 + energy*20);
                tempColor.setRGB(r,g,bVal);
                material.color.copy(tempColor);
                
                activeRings.push({ 
                  mesh: ringMesh, 
                  spawnTime: currentTime, 
                  lifetime: 1000 + energy * 1000, // ms
                  maxRadius: maxRingRadius * (0.25 + energy * 0.75) 
                });
                scene.add(ringMesh);
            }
        });

        for (let i = activeRings.length - 1; i >= 0; i--) {
            const ring = activeRings[i];
            const age = currentTime - ring.spawnTime;
            if (age > ring.lifetime) {
                scene.remove(ring.mesh); 
                ring.mesh.material.dispose(); 
                activeRings.splice(i, 1); 
                continue;
            }
            const lifeProgress = age / ring.lifetime;
            const currentRadius = lifeProgress * ring.maxRadius;
            if (currentRadius < 1) continue; 
            
            ring.mesh.scale.set(currentRadius, currentRadius, 1);
            
            const opacityFade = Math.sin(Math.PI * (1.0 - lifeProgress)); 
            const alpha = opacityFade * (0.4 + audioData.rms * 0.5) * settings.brightCap * 1.1;
            ring.mesh.material.opacity = Math.min(0.85, Math.max(0, alpha));
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
        if (webGLAssets.ringGeometry) (webGLAssets.ringGeometry as THREE.RingGeometry).dispose();
      }
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    rendererType: 'webgl',
    thumbnailUrl: 'https://placehold.co/120x80/E1CCFF/5A36BB.png?text=Grid&font=poppins', // SBNF Lavender on Deep Purple
    dataAiHint: 'neon grid pulse',
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;

        const GRID_SIZE_X = 16; 
        const GRID_SIZE_Y = Math.floor(GRID_SIZE_X * (canvas.height / canvas.width));
        const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

        const cellGeom = new THREE.PlaneGeometry(1, 1); 
        const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: false }); 
        const instancedMesh = new THREE.InstancedMesh(cellGeom, cellMaterial, totalCells);
        scene.add(instancedMesh);

        const cellWidth = canvas.width / GRID_SIZE_X;
        const cellHeight = canvas.height / GRID_SIZE_Y;
        const dummy = new THREE.Object3D();
        const initialColor = new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`);
        const cellStates: { currentColor: THREE.Color, targetColor: THREE.Color, lastUpdateTime: number, currentScale: number }[] = [];

        for (let j_idx = 0; j_idx < GRID_SIZE_Y; j_idx++) {
            for (let i_idx = 0; i_idx < GRID_SIZE_X; i_idx++) {
                const index = j_idx * GRID_SIZE_X + i_idx;
                dummy.position.set((i_idx - GRID_SIZE_X / 2 + 0.5) * cellWidth, (j_idx - GRID_SIZE_Y / 2 + 0.5) * cellHeight, 0);
                dummy.scale.set(cellWidth * 0.9, cellHeight * 0.9, 1); 
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
            dummy: new THREE.Object3D(), tempColor: new THREE.Color(), lastFrameTime: performance.now(),
            bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`),
        } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, GRID_SIZE_X: number, GRID_SIZE_Y: number, totalCells: number, cellWidth: number, cellHeight: number, cellStates: any[], dummy: THREE.Object3D, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.cellStates || !webGLAssets.dummy || !webGLAssets.tempColor || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
        
        const { instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellWidth, cellHeight, cellStates, dummy, tempColor, bgColor } = webGLAssets as any;
        const currentTime = performance.now();
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearColor(bgColor.getHex(), 1); 

        const spectrum = audioData.spectrum;
        const spectrumLength = spectrum.length;
        const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

        for (let j = 0; j < GRID_SIZE_Y; j++) {
            for (let i = 0; i < GRID_SIZE_X; i++) {
                const index = j * GRID_SIZE_X + i;
                if (index >= totalCells) continue; 

                const spectrumIndex = Math.floor((index / totalCells) * spectrumLength) % spectrumLength;
                const energy = (spectrum[spectrumIndex] || 0) / 255; 
                const cellState = cellStates[index];
                const beatFactor = audioData.beat ? 1.3 : 1.0;
                
                const targetLightness = 0.2 + energy * 0.5 * beatFactor * settings.brightCap;
                const targetSaturation = 0.75 + energy * 0.25;
                const baseHue = sbnfHues[(i + j + Math.floor(currentTime / 2000)) % sbnfHues.length];
                const hue = (baseHue + energy * 30 + (audioData.beat ? 20 : 0)) % 360;

                const [r,g,bVal] = hslToRgb(hue, Math.min(100, targetSaturation*100), Math.min(80, targetLightness*100));
                cellState.targetColor.setRGB(r,g,bVal);
                cellState.currentColor.lerp(cellState.targetColor, 0.12); 
                instancedMesh.setColorAt(index, cellState.currentColor);

                const baseScaleFactor = 0.9;
                const scalePulse = 1.0 + energy * 0.10 * beatFactor * audioData.rms;
                const targetScale = baseScaleFactor * scalePulse;
                cellState.currentScale = cellState.currentScale * 0.9 + targetScale * 0.1;
                
                instancedMesh.getMatrixAt(index, dummy.matrix); 
                const currentPosition = new THREE.Vector3().setFromMatrixPosition(dummy.matrix);
                dummy.scale.set(cellWidth * cellState.currentScale, cellHeight * cellState.currentScale, 1);
                dummy.position.copy(currentPosition); 
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
    thumbnailUrl: 'https://placehold.co/120x80/5A36BB/FDB143.png?text=Bars&font=poppins', // SBNF Deep Purple with Orange-Yellow
    dataAiHint: 'audio spectrum analysis',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const numBars = Math.floor((settings.fftSize / 2) * 0.7);
      const barWidthRatio = 0.75; 
      const effectiveTotalWidth = canvas.width * 0.95;
      const barPlusGapWidth = effectiveTotalWidth / numBars;
      const barActualWidth = barPlusGapWidth * barWidthRatio;

      const barGeometry = new THREE.PlaneGeometry(barActualWidth, 1); 
      const barMaterial = new THREE.MeshBasicMaterial({ vertexColors: false }); 
      const instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
      const dummy = new THREE.Object3D();
      const initialColor = new THREE.Color(`hsl(${SBNF_HUES_SCENE.deepPurple}, 56%, 10%)`);

      for (let i = 0; i < numBars; i++) {
        const xPosition = (i - (numBars - 1) / 2) * barPlusGapWidth;
        dummy.position.set(xPosition, -canvas.height / 2 + 0.5, 0); 
        dummy.scale.set(1, 1, 1); 
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, initialColor);
      }
      scene.add(instancedMesh);

      return {
        scene, camera, instancedMesh, numBars, barWidth: barPlusGapWidth, barActualWidth,
        dummy: new THREE.Object3D(), color: new THREE.Color(),
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`), // SBNF Black
      } as WebGLSceneAssets & { instancedMesh: THREE.InstancedMesh, numBars: number, barWidth: number, barActualWidth: number, dummy: THREE.Object3D, color: THREE.Color, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      if (!webGLAssets || !webGLAssets.instancedMesh || !webGLAssets.dummy || !webGLAssets.color || !webGLAssets.bgColor) return;
      const { instancedMesh, numBars, barWidth, barActualWidth, dummy, color, bgColor } = webGLAssets as any;

      renderer.setClearColor(bgColor.getHex(), 1);

      const spectrum = audioData.spectrum;
      const effectiveBrightCap = Math.max(0.05, settings.brightCap);
      const sbnfHues = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];
      
      const spectrumSumForSilenceCheck = spectrum.reduce((s, v) => s + v, 0);
      const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (numBars * 0.5);

      for (let i = 0; i < numBars; i++) {
        if (i >= spectrum.length) continue;
        
        const normalizedValue = isAudioSilent ? 0.001 : (spectrum[i] || 0) / 255;
        const barHeightBase = normalizedValue * canvasHeight * effectiveBrightCap * 1.1;
        const barHeight = Math.max(1, barHeightBase * (0.4 + audioData.rms * 0.6 + (audioData.beat ? 0.15 : 0)));
        
        dummy.scale.set(1, barHeight, 1); 
        
        const xPosition = (i - (numBars - 1) / 2) * barWidth;
        dummy.position.set(xPosition, barHeight / 2 - canvasHeight / 2, 0); 
        
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        const hueIndex = Math.floor((i / numBars) * sbnfHues.length);
        const baseHue = sbnfHues[hueIndex % sbnfHues.length];
        const specVal = (audioData.spectrum[i] || 0) / 255;
        const hue = (baseHue + specVal * 30 + (audioData.beat ? 20 : 0) + performance.now() / 250) % 360;
        const saturation = 70 + specVal * 30;
        const lightness = 40 + specVal * 35 + (audioData.beat ? 10 : 0);
        
        const [r,g,bVal] = hslToRgb(hue, Math.min(100, saturation), Math.min(75, lightness));
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
    thumbnailUrl: 'https://placehold.co/120x80/FF441A/000000.png?text=Burst&font=poppins', // SBNF Orange-Red on Black
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
        lastFrameTime: performance.now(), bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`), 
      } as WebGLSceneAssets & { particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; spawnTimes: Float32Array; PARTICLE_COUNT: number; lastBeatSpawnTime: number; lastAmbientSpawnTime: number; tempColor: THREE.Color; lastFrameTime: number; bgColor: THREE.Color; };
    },
    drawWebGL: ({ renderer, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
        
        const { particles, material, geometry, positions, colors, velocities, lifetimes, spawnTimes, PARTICLE_COUNT, tempColor, bgColor } = webGLAssets as any;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; 
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearAlpha(0.06); 
        renderer.setClearColor(bgColor.getHex(), renderer.getClearAlpha());

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
            const maxAmbientSpawn = Math.floor(PARTICLE_COUNT * 0.02); 

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
            if (lifetimes[i] > 0) {
                const pIdx = i * 3;
                const age = (currentTime - spawnTimes[i]); 
                const initialLifetimeMs = (lifetimes[i] * 1000) + age + (deltaTime * 1000);
                lifetimes[i] -= deltaTime;

                if (lifetimes[i] <= 0) { 
                    positions[pIdx] = 100000; 
                    colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0; 
                    continue; 
                }
                
                velocities[pIdx] *= dragFactor; velocities[pIdx + 1] *= dragFactor; velocities[pIdx + 2] *= dragFactor;
                positions[pIdx]     += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

                const lifeRatio = Math.max(0, (lifetimes[i]*1000) / initialLifetimeMs);
                const fadeFactor = lifeRatio * 0.96 + 0.04; 
                colors[pIdx] *= fadeFactor; colors[pIdx+1] *= fadeFactor; colors[pIdx+2] *= fadeFactor;
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
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 50; 

      const numSegments = 20;
      const segmentDepth = 100; 
      const segmentRadius = 100;
      const segmentGeometry = new THREE.TorusGeometry(segmentRadius, 2.0, 10, 40); 
      const segments: THREE.Mesh[] = [];

      for (let i = 0; i < numSegments; i++) {
        const material = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.6 });
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * segmentDepth;
        segment.rotation.x = Math.PI / 2; 
        scene.add(segment);
        segments.push(segment);
      }

      return {
        scene, camera, segments, numSegments, segmentDepth, segmentSpeed: 120, cameraBaseFov: 75,
        tempColor: new THREE.Color(), lastFrameTime: performance.now(),
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`), 
      } as WebGLSceneAssets & { segments: THREE.Mesh[], numSegments: number, segmentDepth: number, segmentSpeed: number, cameraBaseFov: number, tempColor: THREE.Color, lastFrameTime: number, bgColor: THREE.Color };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.segments || !(camera instanceof THREE.PerspectiveCamera) || !webGLAssets.cameraBaseFov || !webGLAssets.tempColor || typeof webGLAssets.lastFrameTime === 'undefined' || !webGLAssets.bgColor) return;
        const { segments, segmentDepth, numSegments, segmentSpeed, cameraBaseFov, tempColor, bgColor } = webGLAssets as any;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; 
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearColor(bgColor.getHex(), 1);

        segments.forEach((segment: THREE.Mesh, i: number) => {
            segment.position.z += segmentSpeed * (1 + audioData.rms * 1.0 + (audioData.beat ? 0.3 : 0)) * deltaTime; 
            if (segment.position.z > camera.position.z + segmentDepth / 2) { 
                segment.position.z -= numSegments * segmentDepth; 
            }

            const hueOptions = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.lightLavender];
            const baseHue = hueOptions[(i + Math.floor(currentTime * 0.0002)) % hueOptions.length]; 
            const audioInfluence = audioData.rms * 40 + ((audioData.spectrum[i % audioData.spectrum.length] || 0) / 255) * 30;
            const targetHue = (baseHue + audioInfluence + (audioData.beat ? 20 : 0)) % 360;
            const lightness = 0.3 + audioData.rms * 0.2 + (audioData.beat ? 0.15 : 0) + settings.brightCap * 0.1;
            
            const [r, g, bVal] = hslToRgb(targetHue, 80 + Math.random()*20, Math.min(0.7, lightness) * 100);
            tempColor.setRGB(r, g, bVal);
            if (segment.material instanceof THREE.MeshBasicMaterial) {
                segment.material.color.lerp(tempColor, 0.1); 
                segment.material.opacity = Math.min(0.7, 0.4 + audioData.rms * 0.3 + settings.brightCap * 0.1);
            }

            segment.rotation.z += (audioData.trebleEnergy * 0.025 + 0.001 + audioData.bpm * 0.00002) * (i % 2 === 0 ? 1.2 : -1.4) * deltaTime * 60; 
            segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0006 + i * 0.35) * audioData.midEnergy * 0.6; 
        });

        camera.fov = cameraBaseFov - audioData.rms * 35 * settings.gamma + (audioData.beat ? 8 : 0) ; 
        camera.fov = Math.max(50, Math.min(90, camera.fov)); 
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
    thumbnailUrl: 'https://placehold.co/120x80/FFECDA/000000.png?text=Strobe&font=poppins', // SBNF Cream on Black
    dataAiHint: 'strobe light flash',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); 
      
      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeMaterial = new THREE.MeshBasicMaterial({ 
        color: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`), 
        transparent: true, 
        opacity: 1 
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(planeMesh);

      return {
        scene, camera, planeMesh,  planeMaterial, tempColor: new THREE.Color(),
        bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`),
        lastFrameTime: performance.now(),
      } as WebGLSceneAssets & { planeMesh: THREE.Mesh, planeMaterial: THREE.MeshBasicMaterial, tempColor: THREE.Color, bgColor: THREE.Color, lastFrameTime: number };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets }) => {
      if (!webGLAssets || !webGLAssets.planeMesh || !webGLAssets.planeMaterial || !webGLAssets.tempColor || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
      const { planeMaterial, tempColor, bgColor } = webGLAssets as any;
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0;
      webGLAssets.lastFrameTime = currentTime;

      renderer.setClearColor(bgColor.getHex(), 1.0); 

      if (audioData.beat && settings.brightCap > 0.01) {
        const hueOptions = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.lightPeach];
        const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
        const lightness = 70 + Math.random() * 25; 
        
        const [r,g,bVal] = hslToRgb(hue, 100, lightness);
        tempColor.setRGB(r,g,bVal);
        planeMaterial.color.copy(tempColor);
        planeMaterial.opacity = Math.min(1, settings.brightCap * 1.0);
      } else {
        planeMaterial.opacity = Math.max(0, planeMaterial.opacity - deltaTime * 10.0); 
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
    thumbnailUrl: 'https://placehold.co/120x80/FDB143/5A36BB.png?text=Finale&font=poppins', 
    dataAiHint: 'cosmic explosion stars fireworks',
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 300; 

      const PARTICLE_COUNT = 3000; 
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT); 
      const spawnTimes = new Float32Array(PARTICLE_COUNT);


      const sbnfHuesInitial = [SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];
      const tempColorInit = new THREE.Color();

      for (let i = 0; i < PARTICLE_COUNT; i++) {
          lifetimes[i] = 0; 
          const pIdx = i * 3;
          positions[pIdx] = 100000; 
          positions[pIdx + 1] = 100000;
          positions[pIdx + 2] = 100000;
          
          const hue = sbnfHuesInitial[i % sbnfHuesInitial.length];
          const [r,g,bVal] = hslToRgb(hue, 60 + Math.random() * 20, 30 + Math.random() * 15);
          tempColorInit.setRGB(r,g,bVal);
          colors[pIdx] = tempColorInit.r; colors[pIdx + 1] = tempColorInit.g; colors[pIdx + 2] = tempColorInit.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const material = new THREE.PointsMaterial({ 
        size: 1.8, 
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
        lastFrameTime: performance.now(), bgColor: new THREE.Color(`hsl(${SBNF_HUES_SCENE.black}, 0%, 0%)`),
        rotationSpeed: new THREE.Vector3(0.006, 0.008, 0.003),
      } as WebGLSceneAssets & { particles: THREE.Points; material: THREE.PointsMaterial; geometry: THREE.BufferGeometry; positions: Float32Array; colors: Float32Array; velocities: Float32Array; lifetimes: Float32Array; spawnTimes: Float32Array; PARTICLE_COUNT: number; lastBeatTime: number; tempColor: THREE.Color; lastFrameTime: number; bgColor: THREE.Color; rotationSpeed: THREE.Vector3; };
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        if (!webGLAssets || !webGLAssets.particles || !webGLAssets.geometry || !webGLAssets.bgColor || typeof webGLAssets.lastFrameTime === 'undefined') return;
        
        const { particles, material, geometry, positions, colors, velocities, lifetimes, spawnTimes, PARTICLE_COUNT, tempColor, bgColor, rotationSpeed } = webGLAssets as any;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - webGLAssets.lastFrameTime) / 1000.0; 
        webGLAssets.lastFrameTime = currentTime;

        renderer.setClearAlpha(0.07); 
        renderer.setClearColor(bgColor.getHex(), renderer.getClearAlpha());

        const beatCooldown = 180; 
        const sbnfHuesBurst = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender];
        
        if (audioData.beat && (currentTime - (webGLAssets.lastBeatTime || 0) > beatCooldown)) {
            webGLAssets.lastBeatTime = currentTime;
            let particlesToSpawn = Math.floor(PARTICLE_COUNT * (0.20 + audioData.bassEnergy * 0.10 + audioData.rms * 0.05));
            particlesToSpawn = Math.min(particlesToSpawn, Math.floor(PARTICLE_COUNT * 0.25)); 
            let spawnedCount = 0;

            for (let i = 0; i < PARTICLE_COUNT && spawnedCount < particlesToSpawn; i++) {
                if (lifetimes[i] <= 0) { 
                    const pIdx = i * 3;
                    positions[pIdx] = (Math.random() - 0.5) * 10; 
                    positions[pIdx + 1] = (Math.random() - 0.5) * 10;
                    positions[pIdx + 2] = (Math.random() - 0.5) * 10;
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1.0);
                    const speed = 120 + Math.random() * 160 + audioData.bassEnergy * 180 + audioData.rms * 90;
                    
                    velocities[pIdx]     = speed * Math.sin(phi) * Math.cos(theta);
                    velocities[pIdx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    velocities[pIdx + 2] = speed * Math.cos(phi);
                    
                    const hue = sbnfHuesBurst[Math.floor(Math.random() * sbnfHuesBurst.length)];
                    const baseLightness = 45 + Math.random() * 20; 
                    const lightnessVariation = (audioData.beat ? 10 : 0) + (audioData.rms * 15);
                    const finalLightness = Math.min(75, baseLightness + lightnessVariation); 
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
            if (lifetimes[i] > 0) { 
                const pIdx = i * 3;
                const age = (currentTime - spawnTimes[i]); 
                const initialLifetimeMs = (lifetimes[i] * 1000) + age + (deltaTime * 1000); 

                lifetimes[i] -= deltaTime;

                if (lifetimes[i] <= 0) { 
                    positions[pIdx] = 100000; 
                    velocities[pIdx] = 0; velocities[pIdx+1] = 0; velocities[pIdx+2] = 0; 
                    colors[pIdx] = 0; colors[pIdx+1] = 0; colors[pIdx+2] = 0;
                    continue; 
                }
                
                velocities[pIdx] *= dragFactor; velocities[pIdx + 1] *= dragFactor; velocities[pIdx + 2] *= dragFactor;
                positions[pIdx]     += velocities[pIdx] * deltaTime;
                positions[pIdx + 1] += velocities[pIdx + 1] * deltaTime;
                positions[pIdx + 2] += velocities[pIdx + 2] * deltaTime;

                const lifeRatio = Math.max(0, (lifetimes[i]*1000) / initialLifetimeMs); 
                const fadeFactor = Math.pow(lifeRatio, 0.5); 
                colors[pIdx] *= fadeFactor; colors[pIdx+1] *= fadeFactor; colors[pIdx+2] *= fadeFactor;
            }
        }

        if(geometry.attributes.position) (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        if(geometry.attributes.color) (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        
        material.size = (1.6 + audioData.rms * 2.5) * Math.max(0.1, settings.brightCap); 
        material.opacity = Math.max(0.1, settings.brightCap * (0.25 + audioData.rms * 0.45)); 

        if (particles && rotationSpeed) {
            particles.rotation.x += rotationSpeed.x * deltaTime * (0.1 + audioData.midEnergy * 0.4);
            particles.rotation.y += rotationSpeed.y * deltaTime * (0.1 + audioData.trebleEnergy * 0.4);
        }

        if(camera && camera instanceof THREE.PerspectiveCamera) {
            camera.fov = 75 + audioData.rms * 2; 
            camera.fov = Math.max(73, Math.min(77, camera.fov)); 
            camera.updateProjectionMatrix();
            camera.position.z = 300 - audioData.rms * 20; 
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
