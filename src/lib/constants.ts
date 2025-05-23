
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import type { Settings, SceneDefinition, AudioData, WebGLSceneAssets, ProceduralVine } from '@/types';
import * as THREE from 'three';
import { SBNF_BODY_FONT_FAMILY, SBNF_TITLE_FONT_FAMILY } from '@/lib/brandingConstants';

export const FFT_SIZES = [128, 256, 512] as const;

export const SBNF_HUES_SCENE = {
  black: 0,
  orangeRed: 13,
  orangeYellow: 36,
  lightPeach: 30,
  lightLavender: 267,
  deepPurple: 258,
  tronBlue: 197,
  tronPink: 337,
} as const;

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

export function generateNoiseTexture(width: number, height: number): THREE.DataTexture {
  const size = width * height;
  const data = new Uint8Array(4 * size);
  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    const x = (i % width) / width;
    const y = Math.floor(i / width) / height;
    let v = 0;
    for (let o = 0; o < 4; o++) {
      const freq = 2 ** o;
      const amp = 0.5 ** o;
      v += Math.sin(x * Math.PI * freq * 5 + Math.random() * 0.2) * amp;
      v += Math.cos(y * Math.PI * freq * 7 + Math.random() * 0.3) * amp;
    }
    v = (v / 1.5 + 1) / 2;
    const value = Math.floor(v * 180) + 75;
    data[stride] = data[stride + 1] = data[stride + 2] = value;
    data[stride + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export const DEFAULT_SETTINGS: Settings = {
  fftSize: 256,
  gain: 1,
  enableAgc: true,
  gamma: 1,
  dither: 0,
  brightCap: 1,
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
    dataAiHint: 'webcam silhouette performer',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.deepPurple.toString(16)}/${SBNF_HUES_SCENE.lightPeach.toString(16)}.png`,
    initWebGL: (canvas, settings, webcamElement?) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;
      
      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene,
        camera,
        lastCanvasWidth: 0,
        lastCanvasHeight: 0,
        vinesData: {
          activeVines: [] as ProceduralVine[],
          nextVineId: 0,
          lastSpawnTime: 0,
          spawnCooldown: 200, // ms
          maxVines: 15,
        },
        grapesData: {
          activeGrapes: [],
          nextGrapeId: 0,
          lastGrapeSpawnTime: 0,
          spawnCooldown: 150, // ms
          maxGrapes: 50, // Max grapes visible at once
          grapeGeometry: new THREE.SphereGeometry(0.5, 8, 8), // Shared geometry
          grapeBaseMaterial: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }),
        }
      };

      if (webcamElement && webcamElement.videoWidth > 0 && webcamElement.videoHeight > 0) {
        const videoTexture = new THREE.VideoTexture(webcamElement);
        videoTexture.minFilter = THREE.NearestFilter;
        videoTexture.magFilter = THREE.NearestFilter;
        videoTexture.generateMipmaps = false;

        const planeGeometry = new THREE.PlaneGeometry(canvas.width, canvas.height);
        const fresnelShaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            webcamTexture: { value: videoTexture },
            noiseTexture: { value: generateNoiseTexture(256, 256) },
            time: { value: 0.0 },
            dynamicColorVec3: { value: new THREE.Color(0x5A36BB) }, // SBNF Deep Purple
            rimColor: { value: new THREE.Color(0xE1CCFF) },      // SBNF Light Lavender
            fillColor1: { value: new THREE.Color(0x5A36BB) },    // SBNF Deep Purple
            fillColor2: { value: new THREE.Color(0xE1CCFF) },    // SBNF Light Lavender
            opacityFactor: { value: 1.0 },
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
            uniform vec3 dynamicColorVec3; // For difference blend, not directly used in Fresnel version
            uniform vec3 rimColor;
            uniform vec3 fillColor1;
            uniform vec3 fillColor2;
            uniform float opacityFactor;
            uniform vec2 resolution;
            varying vec2 vUv;

            float fresnel(vec2 screenCoord, vec2 texCoord, float rimWidth) {
              vec2 centeredCoord = texCoord * 2.0 - 1.0; // -1 to 1
              float distFromEdge = 1.0 - length(centeredCoord);
              return smoothstep(0.0, rimWidth, distFromEdge);
            }
            
            float luma(vec3 color) {
              return dot(color, vec3(0.299, 0.587, 0.114));
            }

            void main() {
              if (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) > 0.5) discard; // Performance: Checkerboard discard

              vec4 webcamColor = texture2D(webcamTexture, vUv);
              float webcamLuma = luma(webcamColor.rgb);
              float silhouetteAlpha = smoothstep(0.2, 0.5, webcamLuma) * webcamColor.a; // Softer silhouette

              // Fresnel for rim light
              float fresnelFactor = fresnel(gl_FragCoord.xy / resolution.xy, vUv, 0.2); // 0.2 is rim width, adjust as needed
              vec3 finalRimColor = rimColor * fresnelFactor * (1.0 + silhouetteAlpha * 2.0); // Brighter rim on silhouette

              // Scrolling noise for nebula fill
              vec2 scrolledNoiseUv = vUv + vec2(time * 0.03, time * 0.015);
              vec4 noiseColor = texture2D(noiseTexture, scrolledNoiseUv);
              vec3 nebulaFill = mix(fillColor1, fillColor2, noiseColor.r) * (0.4 + noiseColor.g * 0.6);
              
              vec3 blendedFill = mix(vec3(0.0), nebulaFill, silhouetteAlpha * 0.8); // Nebula inside silhouette
              
              vec3 finalColor = blendedFill + finalRimColor;
              
              gl_FragColor = vec4(finalColor, opacityFactor * (silhouetteAlpha + fresnelFactor * 0.5) * 1.85);
              gl_FragColor.rgb *= gl_FragColor.a; // Premultiply alpha
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending, // Good for glowy effects
          depthWrite: false,
        });

        const planeMesh = new THREE.Mesh(planeGeometry, fresnelShaderMaterial);
        scene.add(planeMesh);
        webGLAssets.videoTexture = videoTexture;
        webGLAssets.planeMesh = planeMesh;
        webGLAssets.shaderMaterial = fresnelShaderMaterial;
      }

      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight, webcamElement }) => {
      const currentTime = performance.now();
      if (webGLAssets.shaderMaterial) {
        webGLAssets.shaderMaterial.uniforms.time.value = currentTime * 0.001; // Slow time progression
        webGLAssets.shaderMaterial.uniforms.opacityFactor.value = settings.brightCap * (0.6 + audioData.rms * 0.4);
        webGLAssets.shaderMaterial.uniforms.mirrorX_bool.value = settings.mirrorWebcam;
        webGLAssets.shaderMaterial.uniforms.resolution.value.set(canvasWidth, canvasHeight);

        const baseHue = SBNF_HUES_SCENE.deepPurple;
        const rimHue = (baseHue + 90 + Math.sin(currentTime * 0.0005) * 30) % 360; // Cycle around SBNF lavenders/blues
        const fill1Hue = (baseHue + Math.cos(currentTime * 0.0003) * 40) % 360;
        const fill2Hue = (baseHue - 60 + Math.sin(currentTime * 0.0004) * 40) % 360;
        
        webGLAssets.shaderMaterial.uniforms.rimColor.value.setHSL(rimHue / 360, 0.7 + audioData.trebleEnergy * 0.3, 0.5 + audioData.midEnergy * 0.2);
        webGLAssets.shaderMaterial.uniforms.fillColor1.value.setHSL(fill1Hue / 360, 0.6 + audioData.bassEnergy * 0.2, 0.3 + audioData.rms * 0.2);
        webGLAssets.shaderMaterial.uniforms.fillColor2.value.setHSL(fill2Hue / 360, 0.65 + audioData.midEnergy * 0.25, 0.35 + audioData.rms * 0.25);


        if (webGLAssets.videoTexture && webcamElement && webcamElement.readyState === webcamElement.HAVE_ENOUGH_DATA) {
          webGLAssets.videoTexture.needsUpdate = true;
        }
      }

      // Vine logic
      const vinesData = webGLAssets.vinesData;
      if (vinesData) {
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
            color: `hsla(${SBNF_HUES_SCENE.lightLavender + Math.random() * 60 - 30}, 70%, 65%, 0.7)`,
            opacity: 0.7 + Math.random() * 0.3,
            currentLength: 0,
            maxLength: 50 + Math.random() * 100, // Segments
            spawnTime: currentTime,
            lifetime: 3000 + Math.random() * 4000, // ms
            thickness: 1 + Math.random() * 2,
            curlFactor: 0.05 + Math.random() * 0.1,
            angle: startAngle + (Math.random() - 0.5) * (Math.PI / 3), // Initial angle deviation
            speed: 0.5 + Math.random() * 1.0, // pixels per update step
            startX: sx, // Store initial start for potential re-rooting or effects
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
          vine.opacity = (1.0 - age / vine.lifetime) * (0.7 + Math.random() * 0.3);
          if (vine.currentLength < vine.maxLength) {
            const lastPoint = vine.points[vine.points.length - 1];
            // Add curl/organic movement
            const angleChange = (Math.sin(currentTime * 0.001 * vine.curlFactor + vine.id) + Math.sin(currentTime * 0.0023 * vine.curlFactor + vine.id * 0.5)) * 0.15 * (audioData.rms + 0.1);
            vine.angle += angleChange;

            const segmentLength = vine.speed * (1 + audioData.midEnergy * 2);
            const newX = lastPoint.x + Math.cos(vine.angle) * segmentLength;
            const newY = lastPoint.y + Math.sin(vine.angle) * segmentLength;
            vine.points.push({ x: newX, y: newY });
            vine.currentLength++;
          }
        }
      }
      
      // Grape logic
      const grapesData = webGLAssets.grapesData;
      if (grapesData && grapesData.grapeGeometry && grapesData.grapeBaseMaterial) {
        const { activeGrapes, spawnCooldown, maxGrapes, grapeGeometry, grapeBaseMaterial } = grapesData;
        if (audioData.beat && (currentTime - grapesData.lastSpawnTime > spawnCooldown) && activeGrapes.length < maxGrapes) {
          grapesData.lastSpawnTime = currentTime;
          const numToSpawn = 3 + Math.floor(audioData.bassEnergy * 7);
          for (let k = 0; k < numToSpawn && activeGrapes.length < maxGrapes; k++) {
            grapesData.nextGrapeId++;
            const material = grapeBaseMaterial.clone();
            material.color.setHSL((SBNF_HUES_SCENE.lightLavender + Math.random() * 20 -10) / 360, 0.8, 0.7);
            const grapeMesh = new THREE.Mesh(grapeGeometry, material);
            
            grapeMesh.position.set(
              (Math.random() - 0.5) * canvasWidth * 0.8,
              (Math.random() - 0.5) * canvasHeight * 0.8,
              (Math.random() - 0.5) * 50 
            );
            const initialScale = 5 + audioData.bassEnergy * 15;
            grapeMesh.scale.set(initialScale, initialScale, initialScale);
            
            scene.add(grapeMesh);
            activeGrapes.push({
              id: grapesData.nextGrapeId,
              mesh: grapeMesh,
              spawnTime: currentTime,
              lifetime: 1000 + Math.random() * 1000, // ms
              initialScale,
              targetScale: initialScale * (0.1 + Math.random() * 0.3),
              initialColorHue: (SBNF_HUES_SCENE.lightLavender + Math.random() * 20 -10) / 360,
              targetColorHue: (SBNF_HUES_SCENE.orangeRed - Math.random() * 10) / 360,
            });
          }
        }

        for (let i = activeGrapes.length - 1; i >= 0; i--) {
          const grape = activeGrapes[i];
          const age = currentTime - grape.spawnTime;
          const lifeRatio = Math.min(1, age / grape.lifetime);

          if (lifeRatio >= 1) {
            scene.remove(grape.mesh);
            grape.mesh.material.dispose(); // Assuming cloned material
            activeGrapes.splice(i, 1);
            continue;
          }
          
          const scaleProgress = Math.sin(lifeRatio * Math.PI); // Pop in and out
          const currentScale = grape.initialScale * scaleProgress * (1 + audioData.rms * 0.5);
          grape.mesh.scale.set(currentScale, currentScale, currentScale);

          const currentHue = grape.initialColorHue + (grape.targetColorHue - grape.initialColorHue) * lifeRatio;
          (grape.mesh.material as THREE.MeshBasicMaterial).color.setHSL(currentHue, 0.8, 0.6 + (1.0-lifeRatio) * 0.2);
          (grape.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - lifeRatio) * 0.8;
        }
      }
    },
    cleanupWebGL: (webGLAssets) => {
      if (webGLAssets.videoTexture) webGLAssets.videoTexture.dispose();
      if (webGLAssets.planeMesh) {
        if (webGLAssets.planeMesh.geometry) webGLAssets.planeMesh.geometry.dispose();
        if (webGLAssets.planeMesh.material) (webGLAssets.planeMesh.material as THREE.Material).dispose();
      }
      if (webGLAssets.shaderMaterial) webGLAssets.shaderMaterial.dispose();
      if (webGLAssets.noiseTexture) webGLAssets.noiseTexture.dispose();

      if (webGLAssets.grapesData) {
        webGLAssets.grapesData.activeGrapes.forEach((grape: any) => {
          if (grape.mesh) {
            webGLAssets.scene?.remove(grape.mesh); // Ensure removal from scene
            if (grape.mesh.material) (grape.mesh.material as THREE.Material).dispose();
          }
        });
        if (webGLAssets.grapesData.grapeGeometry) webGLAssets.grapesData.grapeGeometry.dispose();
        if (webGLAssets.grapesData.grapeBaseMaterial) webGLAssets.grapesData.grapeBaseMaterial.dispose();
        webGLAssets.grapesData.activeGrapes = [];
      }
      // Vines are 2D, no WebGL cleanup here
    },
  },
  // ... other scenes
  {
    id: 'echoing_shapes',
    name: 'Echoing Shapes',
    rendererType: 'webgl',
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

      const instancedMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        vertexColors: true, // Use instance colors
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
        circleGeometry, squareGeometry, triangleGeometry, instancedMaterial,
        circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh,
        activeInstances: [],
        maxShapeInstances: MAX_SHAPE_INSTANCES,
        dummy: new THREE.Object3D(),
        tempColor: new THREE.Color(),
        lastSpawnTime: 0,
        spawnCooldown: 100, // ms
        lastCanvasWidth: 0,
        lastCanvasHeight: 0,
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const { 
        circleInstancedMesh, squareInstancedMesh, triangleInstancedMesh, 
        activeInstances, maxShapeInstances, dummy, tempColor, spawnCooldown 
      } = webGLAssets;

      const bgColor = new THREE.Color().setHSL(SBNF_HUES_SCENE.black / 360, 0.0, 0.05); // Very dark
      renderer.setClearColor(bgColor, 1.0); // Opaque clear

      // Spawn new shapes
      const shouldSpawn = (audioData.beat && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown / 2)) ||
                          (audioData.rms > 0.1 && (currentTime - webGLAssets.lastSpawnTime > spawnCooldown));

      if (shouldSpawn && activeInstances.length < maxShapeInstances * 3) {
        webGLAssets.lastSpawnTime = currentTime;
        const numToSpawn = 1 + Math.floor(audioData.rms * 5);

        for (let i = 0; i < numToSpawn && activeInstances.length < maxShapeInstances * 3; i++) {
          const shapeType = Math.floor(Math.random() * 3); // 0: circle, 1: square, 2: triangle
          const initialScale = (canvasWidth / 20) * (0.4 + audioData.bassEnergy * 1.2);
          const lifetime = 1500 + Math.random() * 2000;
          
          const hueOptions = [SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.tronBlue];
          const baseHue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
          const finalHue = (baseHue + (currentTime * 0.01) + (audioData.trebleEnergy * 60)) % 360;

          activeInstances.push({
            type: shapeType,
            x: (Math.random() - 0.5) * canvasWidth * 0.9,
            y: (Math.random() - 0.5) * canvasHeight * 0.9,
            z: (Math.random() - 0.5) * 5, // Slight depth variation
            initialScale,
            maxScale: initialScale * (1.5 + audioData.rms * 2.5),
            rotationSpeed: (Math.random() - 0.5) * 0.05,
            rotation: Math.random() * Math.PI * 2,
            spawnTime: currentTime,
            lifetime,
            initialLifetime: lifetime,
            color: new THREE.Color().setHSL(finalHue / 360, 0.7, 0.6),
            opacity: Math.min(0.85, 0.5 + audioData.rms * 0.5) * settings.brightCap,
            targetOpacity: Math.min(0.85, 0.5 + audioData.rms * 0.5) * settings.brightCap, // For direct use
            currentOpacity: Math.min(0.85, 0.5 + audioData.rms * 0.5) * settings.brightCap, // For direct use
          });
        }
      }

      // Update and render active instances
      let circleCount = 0, squareCount = 0, triangleCount = 0;
      
      for (let i = activeInstances.length - 1; i >= 0; i--) {
        const instance = activeInstances[i];
        const age = currentTime - instance.spawnTime;
        const lifeRatio = age / instance.initialLifetime;

        if (lifeRatio >= 1) {
          activeInstances.splice(i, 1);
          continue;
        }

        instance.rotation += instance.rotationSpeed * (1 + audioData.midEnergy);
        const scaleProgress = Math.sin(lifeRatio * Math.PI); // Pop in and out
        const currentScale = instance.initialScale + (instance.maxScale - instance.initialScale) * scaleProgress;
        
        dummy.position.set(instance.x, instance.y, instance.z);
        dummy.rotation.z = instance.rotation;
        dummy.scale.set(currentScale, currentScale, currentScale);
        dummy.updateMatrix();

        tempColor.copy(instance.color).multiplyScalar(1.0 - lifeRatio); // Fade color to black (effectively opacity)

        if (instance.type === 0 && circleCount < maxShapeInstances) {
          circleInstancedMesh.setMatrixAt(circleCount, dummy.matrix);
          circleInstancedMesh.setColorAt(circleCount, tempColor);
          circleCount++;
        } else if (instance.type === 1 && squareCount < maxShapeInstances) {
          squareInstancedMesh.setMatrixAt(squareCount, dummy.matrix);
          squareInstancedMesh.setColorAt(squareCount, tempColor);
          squareCount++;
        } else if (instance.type === 2 && triangleCount < maxShapeInstances) {
          triangleInstancedMesh.setMatrixAt(triangleCount, dummy.matrix);
          triangleInstancedMesh.setColorAt(triangleCount, tempColor);
          triangleCount++;
        }
      }

      circleInstancedMesh.count = circleCount;
      squareInstancedMesh.count = squareCount;
      triangleInstancedMesh.count = triangleCount;

      if (circleCount > 0) circleInstancedMesh.instanceMatrix.needsUpdate = true;
      if (circleCount > 0) circleInstancedMesh.instanceColor!.needsUpdate = true;
      if (squareCount > 0) squareInstancedMesh.instanceMatrix.needsUpdate = true;
      if (squareCount > 0) squareInstancedMesh.instanceColor!.needsUpdate = true;
      if (triangleCount > 0) triangleInstancedMesh.instanceMatrix.needsUpdate = true;
      if (triangleCount > 0) triangleInstancedMesh.instanceColor!.needsUpdate = true;
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.circleGeometry?.dispose();
      webGLAssets.squareGeometry?.dispose();
      webGLAssets.triangleGeometry?.dispose();
      webGLAssets.instancedMaterial?.dispose();
      webGLAssets.circleInstancedMesh?.dispose();
      webGLAssets.squareInstancedMesh?.dispose();
      webGLAssets.triangleInstancedMesh?.dispose();
      webGLAssets.activeInstances = [];
    },
  },
  {
    id: 'frequency_rings',
    name: 'Frequency Rings',
    rendererType: 'webgl',
    dataAiHint: 'concentric rings audio frequency',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.deepPurple.toString(16)}/${SBNF_HUES_SCENE.tronBlue.toString(16)}.png`,
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const ringGeometry = new THREE.RingGeometry(0.48, 0.5, 64); // Thin ring
      
      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene,
        camera,
        ringGeometry,
        activeBassRings: [],
        activeMidRings: [],
        activeTrebleRings: [],
        lastSpawnTimes: { bass: 0, mid: 0, treble: 0 },
        spawnCooldown: 50, // ms
        maxRingsPerBand: 20,
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const { ringGeometry, activeBassRings, activeMidRings, activeTrebleRings, lastSpawnTimes, spawnCooldown, maxRingsPerBand } = webGLAssets;

      const SBNF_COLORS = {
        bass: new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeRed / 360, 0.9, 0.6),
        mid: new THREE.Color().setHSL(SBNF_HUES_SCENE.orangeYellow / 360, 0.9, 0.65),
        treble: new THREE.Color().setHSL(SBNF_HUES_SCENE.lightLavender / 360, 0.8, 0.7),
      };
      
      const spawnRing = (band: 'bass' | 'mid' | 'treble', energy: number, ringArray: any[]) => {
        if (energy > 0.1 && currentTime - lastSpawnTimes[band] > spawnCooldown && ringArray.length < maxRingsPerBand) {
          lastSpawnTimes[band] = currentTime;
          const material = new THREE.MeshBasicMaterial({ 
            color: SBNF_COLORS[band], 
            transparent: true, 
            opacity: 0.3 + energy * 0.7,
            side: THREE.DoubleSide,
          });
          const ringMesh = new THREE.Mesh(ringGeometry, material);
          ringMesh.scale.set(canvasWidth * 0.05, canvasWidth * 0.05, 1); // Start small
          scene.add(ringMesh);
          ringArray.push({ 
            mesh: ringMesh, 
            spawnTime: currentTime, 
            lifetime: 1000 + energy * 1000, // Lifetime based on energy
            initialOpacity: material.opacity,
            maxScale: canvasWidth * (0.8 + energy * 0.4), // Max expansion based on energy
          });
        }
      };

      spawnRing('bass', audioData.bassEnergy, activeBassRings);
      spawnRing('mid', audioData.midEnergy, activeMidRings);
      spawnRing('treble', audioData.trebleEnergy, activeTrebleRings);

      const updateRingArray = (ringArray: any[]) => {
        for (let i = ringArray.length - 1; i >= 0; i--) {
          const ring = ringArray[i];
          const age = currentTime - ring.spawnTime;
          const lifeRatio = Math.min(1, age / ring.lifetime);

          if (lifeRatio >= 1) {
            scene.remove(ring.mesh);
            ring.mesh.geometry.dispose(); // Should be shared, but material is unique
            ring.mesh.material.dispose();
            ringArray.splice(i, 1);
            continue;
          }
          
          const scale = canvasWidth * 0.05 + lifeRatio * ring.maxScale;
          ring.mesh.scale.set(scale, scale, 1);
          ring.mesh.material.opacity = ring.initialOpacity * (1.0 - lifeRatio) * settings.brightCap;
        }
      };

      updateRingArray(activeBassRings);
      updateRingArray(activeMidRings);
      updateRingArray(activeTrebleRings);
    },
    cleanupWebGL: (webGLAssets) => {
      const cleanupArray = (arr: any[]) => {
        arr.forEach(ring => {
          webGLAssets.scene?.remove(ring.mesh);
          ring.mesh.material.dispose();
        });
        arr.length = 0;
      };
      cleanupArray(webGLAssets.activeBassRings);
      cleanupArray(webGLAssets.activeMidRings);
      cleanupArray(webGLAssets.activeTrebleRings);
      webGLAssets.ringGeometry?.dispose();
    },
  },
  {
    id: 'neon_pulse_grid',
    name: 'Neon Pulse Grid',
    rendererType: 'webgl',
    dataAiHint: 'pulsing grid light cells audio',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.tronPink.toString(16)}.png`,
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
      camera.position.z = 1;

      const GRID_SIZE_X = 16;
      const GRID_SIZE_Y = Math.round(GRID_SIZE_X * (canvas.height / canvas.width)) || 1;
      const totalCells = GRID_SIZE_X * GRID_SIZE_Y;

      const cellGeometry = new THREE.PlaneGeometry(1, 1); // Base geometry for one cell
      const cellMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
      const instancedMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, totalCells);
      scene.add(instancedMesh);

      const cellBaseWidth = canvas.width / GRID_SIZE_X;
      const cellBaseHeight = canvas.height / GRID_SIZE_Y;
      const dummy = new THREE.Object3D();
      const cellStates = [];

      for (let y = 0; y < GRID_SIZE_Y; y++) {
        for (let x = 0; x < GRID_SIZE_X; x++) {
          const i = y * GRID_SIZE_X + x;
          dummy.position.set(
            (x - GRID_SIZE_X / 2 + 0.5) * cellBaseWidth,
            (y - GRID_SIZE_Y / 2 + 0.5) * cellBaseHeight,
            0
          );
          dummy.scale.set(cellBaseWidth * 0.9, cellBaseHeight * 0.9, 1); // 0.9 for spacing
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
          instancedMesh.setColorAt(i, new THREE.Color(0x111111)); // Dim initial color
          cellStates.push({ currentLightness: 0.1, targetLightness: 0.1, lastPulseTime: 0 });
        }
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.instanceColor!.needsUpdate = true;

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, instancedMesh, cellGeometry, cellMaterial,
        GRID_SIZE_X, GRID_SIZE_Y, totalCells, cellBaseWidth, cellBaseHeight, cellStates,
        dummy: new THREE.Object3D(), tempColor: new THREE.Color(),
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const { instancedMesh, GRID_SIZE_X, GRID_SIZE_Y, cellStates, tempColor } = webGLAssets;
      const currentTime = performance.now();

      renderer.setClearColor(SBNF_HUES_SCENE.black, 0.1); // Very low alpha for trails

      const spectrum = audioData.spectrum;
      const spectrumLength = spectrum.length;
      
      const SBNF_HUES_ORDER = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];

      for (let i = 0; i < webGLAssets.totalCells; i++) {
        const spectrumIndex = Math.floor((i / webGLAssets.totalCells) * spectrumLength);
        const energy = (spectrum[spectrumIndex] / 255) * settings.brightCap; // Normalize and apply brightCap

        const cellState = cellStates[i];
        if (audioData.beat && energy > 0.3 && (currentTime - cellState.lastPulseTime > 100)) {
          cellState.targetLightness = 0.6 + energy * 0.4; // Brighter pulse on beat
          cellState.lastPulseTime = currentTime;
        } else {
          cellState.targetLightness = 0.1 + energy * 0.5; // Base energy glow
        }
        
        // Smoothly interpolate lightness
        cellState.currentLightness += (cellState.targetLightness - cellState.currentLightness) * 0.1;

        const hueCycleSpeed = 0.00005;
        const baseHueIndex = Math.floor((i / GRID_SIZE_X) + (currentTime * hueCycleSpeed)) % SBNF_HUES_ORDER.length;
        const hue = SBNF_HUES_ORDER[baseHueIndex];
        
        tempColor.setHSL(
          hue / 360,
          0.7 + energy * 0.3, // Saturation increases with energy
          Math.max(0.05, cellState.currentLightness) // Ensure minimum visibility
        );
        instancedMesh.setColorAt(i, tempColor);
      }
      instancedMesh.instanceColor!.needsUpdate = true;
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
    rendererType: 'webgl',
    dataAiHint: 'frequency bars audio spectrum',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeRed.toString(16)}.png`,
    initWebGL: (canvas, settings) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
        camera.position.z = 1;

        const numBars = settings.fftSize / 2;
        const barGeometry = new THREE.PlaneGeometry(1, 1); // Base geometry for one bar
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
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
        const { instancedMesh, numBars, dummy, tempColor } = webGLAssets;
        const spectrum = audioData.spectrum;

        renderer.setClearColor(SBNF_HUES_SCENE.deepPurple, 1.0);

        if (canvasWidth !== webGLAssets.lastCanvasWidth || canvasHeight !== webGLAssets.lastCanvasHeight) {
            camera.left = -canvasWidth / 2;
            camera.right = canvasWidth / 2;
            camera.top = canvasHeight / 2;
            camera.bottom = -canvasHeight / 2;
            camera.updateProjectionMatrix();
            webGLAssets.lastCanvasWidth = canvasWidth;
            webGLAssets.lastCanvasHeight = canvasHeight;
        }
        
        const barActualWidth = canvasWidth / numBars;
        const SBNF_HUES_ORDER = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.tronBlue];

        const spectrumSumForSilenceCheck = spectrum.reduce((s, v) => s + v, 0);
        const isAudioSilent = audioData.rms < 0.01 && spectrumSumForSilenceCheck < (spectrum.length * 0.5);

        for (let i = 0; i < numBars; i++) {
            const value = isAudioSilent ? 0.001 : spectrum[i] / 255; // Normalize to 0-1, minimal height if silent
            const effectiveBrightCap = Math.max(0.01, settings.brightCap); // Prevent zero brightcap from making bars disappear
            const barHeight = Math.max(1, value * canvasHeight * 0.8 * effectiveBrightCap * (1 + audioData.rms * 0.5));
            
            const hueIndex = Math.floor((i / numBars) * SBNF_HUES_ORDER.length + (performance.now() * 0.00005 * (50 + audioData.bpm/2))) % SBNF_HUES_ORDER.length;
            const hue = SBNF_HUES_ORDER[hueIndex];
            const saturation = 0.6 + value * 0.4; // More saturated with higher energy
            const lightness = 0.4 + value * 0.3 + (audioData.beat ? 0.15 : 0); // Brighter with energy and beat
            
            tempColor.setHSL(hue / 360, saturation, Math.min(0.75, lightness));
            
            dummy.position.set(
                (i - numBars / 2 + 0.5) * barActualWidth,
                barHeight / 2 - canvasHeight / 2, // Position Y at bottom, grow upwards
                0
            );
            dummy.scale.set(barActualWidth * 0.9, barHeight, 1); // 0.9 for spacing
            dummy.updateMatrix();
            
            instancedMesh.setMatrixAt(i, dummy.matrix);
            instancedMesh.setColorAt(i, tempColor);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.instanceColor!.needsUpdate = true;
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
    rendererType: 'webgl',
    dataAiHint: 'particle explosion audio beat',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeRed.toString(16)}.png`,
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      camera.position.z = 300;

      const PARTICLE_COUNT = 4000;
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); // Store individual velocities
      const lifetimes = new Float32Array(PARTICLE_COUNT);    // Store individual lifetimes

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 3, // Base size, can be modulated
        vertexColors: true,
        transparent: true,
        opacity: 0.8, // Base opacity
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        depthWrite: false,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Initialize all particles as "dead" (lifetime 0)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes[i] = 0;
      }

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, particles, particleMaterial: material, particleGeometry: geometry,
        positions, colors, velocities, lifetimes, PARTICLE_COUNT,
        lastBeatTime: 0, lastAmbientSpawnTime: 0, lastFrameTimeWebGL: performance.now(),
        tempColor: new THREE.Color(),
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000; // seconds
      webGLAssets.lastFrameTimeWebGL = currentTime;

      const { particles, positions, colors, velocities, lifetimes, PARTICLE_COUNT, tempColor } = webGLAssets;
      
      renderer.setClearColor(SBNF_HUES_SCENE.black, 0.15); // SBNF black with trails

      const dragFactor = 0.97;
      const SBNF_BURST_HUES = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach];
      const SBNF_AMBIENT_HUES = [SBNF_HUES_SCENE.deepPurple, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.tronBlue];

      // Particle Spawning
      let spawnedThisFrame = 0;
      const beatCooldown = 100; // ms between beat bursts
      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
        webGLAssets.lastBeatTime = currentTime;
        const maxBurstParticlesThisBeat = Math.floor(PARTICLE_COUNT * (0.08 + audioData.bassEnergy * 0.25));
        let burstSpawned = 0;
        for (let i = 0; i < PARTICLE_COUNT && burstSpawned < maxBurstParticlesThisBeat; i++) {
          if (lifetimes[i] <= 0) { // Find a "dead" particle
            const pIdx = i * 3;
            positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 0; // Start at center
            
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos((Math.random() * 2) - 1);
            const speed = 100 + (audioData.rms + audioData.bassEnergy) * 200 * (Math.random() * 0.5 + 0.75);
            velocities[pIdx] = Math.sin(theta) * Math.cos(phi) * speed;
            velocities[pIdx + 1] = Math.sin(theta) * Math.sin(phi) * speed;
            velocities[pIdx + 2] = Math.cos(theta) * speed;
            
            lifetimes[i] = 1.0 + Math.random() * 1.5; // seconds
            
            const hue = SBNF_BURST_HUES[Math.floor(Math.random() * SBNF_BURST_HUES.length)];
            tempColor.setHSL(hue / 360, 0.9, 0.6 + Math.random() * 0.2);
            colors[pIdx] = tempColor.r;
            colors[pIdx + 1] = tempColor.g;
            colors[pIdx + 2] = tempColor.b;
            
            burstSpawned++;
            spawnedThisFrame++;
          }
        }
      }
      
      // Ambient spawning based on RMS
      const ambientSpawnCap = Math.floor(PARTICLE_COUNT * 0.03); // Max ambient particles to spawn per frame
      let ambientSpawned = 0;
      if (audioData.rms > 0.05 && spawnedThisFrame < ambientSpawnCap) {
         for (let i = 0; i < PARTICLE_COUNT && ambientSpawned < (ambientSpawnCap - spawnedThisFrame) ; i++) {
            if (lifetimes[i] <= 0) {
                const pIdx = i * 3;
                positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 0;
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.acos((Math.random() * 2) - 1);
                const speed = 30 + audioData.rms * 100 * (Math.random() * 0.5 + 0.5);
                velocities[pIdx] = Math.sin(theta) * Math.cos(phi) * speed;
                velocities[pIdx + 1] = Math.sin(theta) * Math.sin(phi) * speed;
                velocities[pIdx + 2] = Math.cos(theta) * speed;
                lifetimes[i] = 1.5 + Math.random() * 2.0;
                const hue = SBNF_AMBIENT_HUES[Math.floor(Math.random() * SBNF_AMBIENT_HUES.length)];
                tempColor.setHSL(hue / 360, 0.7, 0.5 + Math.random() * 0.15);
                colors[pIdx] = tempColor.r;
                colors[pIdx + 1] = tempColor.g;
                colors[pIdx + 2] = tempColor.b;
                ambientSpawned++;
            }
        }
      }


      // Update particles
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

          // Fade out (by darkening color for additive blending)
          const lifeRatio = Math.max(0, lifetimes[i]) / (1.0 + Math.random() * 1.5); // Use initial lifetime variation
          tempColor.setRGB(colors[pIdx], colors[pIdx+1], colors[pIdx+2]);
          tempColor.multiplyScalar(lifeRatio);
          colors[pIdx] = tempColor.r;
          colors[pIdx+1] = tempColor.g;
          colors[pIdx+2] = tempColor.b;

          if (lifetimes[i] <= 0) { // Particle died
            positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 10000; // Move off-screen
          }
        }
      }

      webGLAssets.particleMaterial.size = Math.max(1, 2 + settings.brightCap * 3 + audioData.rms * 5);
      webGLAssets.particleMaterial.opacity = Math.min(1, 0.5 + settings.brightCap * 0.5 + audioData.rms * 0.5);
      
      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.color.needsUpdate = true;

      // Camera movement for depth
      camera.position.z = 300 - audioData.rms * 150;
      camera.fov = 75 - audioData.rms * 20;
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
    rendererType: 'webgl',
    dataAiHint: 'geometric tunnel flight tron',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.tronBlue.toString(16)}.png`,
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const cameraBaseFov = 70;
      const camera = new THREE.PerspectiveCamera(cameraBaseFov, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 0;

      const NUM_SEGMENTS = 30;
      const SEGMENT_SPACING = 50;
      const tunnelSegments: THREE.Mesh[] = [];
      const segmentGeometry = new THREE.TorusGeometry(20, 1.5, 8, 24); // Ring shape, adjust params for look
      
      for (let i = 0; i < NUM_SEGMENTS; i++) {
        const material = new THREE.MeshBasicMaterial({ 
          color: 0xffffff, // Initial color, will be changed
          wireframe: true,
          transparent: true,
          opacity: 0.7
        });
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.z = -i * SEGMENT_SPACING;
        scene.add(segment);
        tunnelSegments.push(segment);
      }
      
      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, tunnelSegments, NUM_SEGMENTS, SEGMENT_SPACING,
        cameraBaseFov, lastFrameTimeWebGL: performance.now(), tempColor: new THREE.Color(),
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      const { tunnelSegments, NUM_SEGMENTS, SEGMENT_SPACING, cameraBaseFov, tempColor } = webGLAssets;
      
      renderer.setClearColor(SBNF_HUES_SCENE.black, 1); // SBNF Black background

      const SBNF_TRON_HUES = [SBNF_HUES_SCENE.tronBlue, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.tronPink];

      // Move camera forward
      const speed = 30 + audioData.rms * 100 + audioData.bpm * 0.1;
      camera.position.z -= speed * deltaTime;

      tunnelSegments.forEach((segment, i) => {
        // Recycle segments that are behind the camera
        if (segment.position.z > camera.position.z) {
          segment.position.z -= NUM_SEGMENTS * SEGMENT_SPACING;
        }

        // Audio reactivity
        const scaleFactor = 1 + Math.sin(currentTime * 0.001 + i * 0.5) * 0.1 + audioData.bassEnergy * 0.3;
        segment.scale.set(scaleFactor, scaleFactor, scaleFactor);

        const hueTimeFactor = currentTime * 0.0001;
        const hueIndex = Math.floor(hueTimeFactor + i * 0.3) % SBNF_TRON_HUES.length;
        const hue = SBNF_TRON_HUES[hueIndex];
        const saturation = 0.7 + audioData.midEnergy * 0.3;
        const lightness = 0.4 + audioData.trebleEnergy * 0.3 + (audioData.beat && i % 3 === 0 ? 0.2 : 0); // Pulse some segments on beat
        
        (segment.material as THREE.MeshBasicMaterial).color.setHSL(hue / 360, saturation, Math.min(0.7, lightness));
        (segment.material as THREE.MeshBasicMaterial).opacity = 0.5 + audioData.rms * 0.5 * settings.brightCap;

        segment.rotation.z += (audioData.trebleEnergy * 0.025 + 0.001 + audioData.bpm * 0.00002) * (i % 2 === 0 ? 1.2 : -1.4) * deltaTime * 60;
        segment.rotation.x = Math.PI / 2 + Math.sin(currentTime * 0.0006 + i * 0.35) * audioData.midEnergy * 0.6;
      });

      camera.fov = cameraBaseFov - audioData.rms * 35 * settings.gamma + (audioData.beat ? 8 : 0) ;
      camera.updateProjectionMatrix();
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.tunnelSegments?.forEach(segment => {
        segment.geometry.dispose();
        (segment.material as THREE.Material).dispose();
      });
      webGLAssets.tunnelSegments = [];
    },
  },
  {
    id: 'strobe_light',
    name: 'Strobe Light',
    rendererType: 'webgl',
    dataAiHint: 'flashing light beat strobe',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.lightPeach.toString(16)}.png`,
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); // Simple ortho for full screen quad
      
      const planeGeometry = new THREE.PlaneGeometry(2, 2); // Covers the screen
      const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1 });
      const flashPlane = new THREE.Mesh(planeGeometry, planeMaterial);
      scene.add(flashPlane);

      const webGLAssets: Partial<WebGLSceneAssets> = {
        scene, camera, flashPlane, planeMaterial, planeGeometry,
        lastFlashTime: 0, tempColor: new THREE.Color(),
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const { flashPlane, planeMaterial, tempColor } = webGLAssets;
      const currentTime = performance.now();
      
      if (audioData.beat && (currentTime - webGLAssets.lastFlashTime > 50)) { // Cooldown for flash
        webGLAssets.lastFlashTime = currentTime;
        const hue = (SBNF_HUES_SCENE.orangeYellow + Math.random() * 60 - 30) % 360; // SBNF Oranges/Yellows/Peaches
        tempColor.setHSL(hue / 360, 0.9, 0.7);
        planeMaterial.color.copy(tempColor);
        planeMaterial.opacity = settings.brightCap; // Full brightness based on cap
        flashPlane.visible = true;
      } else {
        if (flashPlane.visible) {
          // Fade out quickly or turn off
          planeMaterial.opacity -= 0.15; // Quick fade
          if (planeMaterial.opacity <= 0) {
            flashPlane.visible = false;
          }
        }
      }
      
      if (!flashPlane.visible) {
        renderer.setClearColor(SBNF_HUES_SCENE.black, 1.0);
      } else {
        // When flashPlane is visible, its material color effectively becomes the background
        // To ensure no other clear, we don't call renderer.setClearColor here.
        // The plane itself covers the screen.
      }
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.planeGeometry?.dispose();
      webGLAssets.planeMaterial?.dispose();
    },
  },
  {
    id: 'particle_finale',
    name: 'Particle Finale',
    rendererType: 'webgl',
    dataAiHint: 'particle system burst stars',
    thumbnailUrl: `https://placehold.co/80x60/${SBNF_HUES_SCENE.black.toString(16)}/${SBNF_HUES_SCENE.orangeRed.toString(16)}.png`,
    initWebGL: (canvas, settings) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 2000);
      camera.position.z = 350;

      const PARTICLE_COUNT = 3000; // Reduced for performance
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const lifetimes = new Float32Array(PARTICLE_COUNT); // Time to live for each particle
      const initialLifetimes = new Float32Array(PARTICLE_COUNT); // Store initial lifetime for fade calculation

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const material = new THREE.PointsMaterial({
        size: 3.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
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
        lastBeatTime: 0, lastFrameTimeWebGL: performance.now(), tempColor: new THREE.Color(),
      };
      return webGLAssets as WebGLSceneAssets;
    },
    drawWebGL: ({ renderer, scene, camera, audioData, settings, webGLAssets, canvasWidth, canvasHeight }) => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - webGLAssets.lastFrameTimeWebGL) / 1000;
      webGLAssets.lastFrameTimeWebGL = currentTime;

      const { particles, positions, colors, velocities, lifetimes, initialLifetimes, PARTICLE_COUNT, tempColor } = webGLAssets;
      
      renderer.setClearColor(SBNF_HUES_SCENE.black, 0.12); // SBNF black, slightly more trails

      const beatCooldown = 120; // ms
      const dragFactor = 0.96;
      const SBNF_FINALE_HUES = [SBNF_HUES_SCENE.orangeRed, SBNF_HUES_SCENE.orangeYellow, SBNF_HUES_SCENE.lightPeach, SBNF_HUES_SCENE.lightLavender, SBNF_HUES_SCENE.deepPurple];

      if (audioData.beat && (currentTime - webGLAssets.lastBeatTime > beatCooldown)) {
        webGLAssets.lastBeatTime = currentTime;
        let spawnedCount = 0;
        const particlesToSpawn = Math.floor(PARTICLE_COUNT * 0.20); // Spawn up to 20% of particles

        for (let i = 0; i < PARTICLE_COUNT && spawnedCount < particlesToSpawn; i++) {
          if (lifetimes[i] <= 0) { // Find a "dead" particle
            const pIdx = i * 3;
            positions[pIdx] = (Math.random() - 0.5) * 10; // Start near center
            positions[pIdx + 1] = (Math.random() - 0.5) * 10;
            positions[pIdx + 2] = (Math.random() - 0.5) * 10;

            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos((Math.random() * 2) - 1);
            const speed = 150 + (audioData.rms + audioData.bassEnergy) * 300 * (0.8 + Math.random() * 0.4);
            velocities[pIdx] = Math.sin(theta) * Math.cos(phi) * speed;
            velocities[pIdx + 1] = Math.sin(theta) * Math.sin(phi) * speed;
            velocities[pIdx + 2] = Math.cos(theta) * speed;
            
            initialLifetimes[i] = 1.8 + Math.random() * 2.2; // seconds
            lifetimes[i] = initialLifetimes[i];
            
            const hue = SBNF_FINALE_HUES[Math.floor(Math.random() * SBNF_FINALE_HUES.length)];
            const baseLightness = 40 + Math.random() * 25; // Range 40-65
            const lightnessVariation = (audioData.beat ? 10 : 0) + (audioData.rms * 10);
            const finalLightness = Math.min(70, baseLightness + lightnessVariation); // Cap lightness
            tempColor.setHSL(hue / 360, 0.85 + Math.random() * 0.15, finalLightness / 100);
            colors[pIdx] = tempColor.r;
            colors[pIdx + 1] = tempColor.g;
            colors[pIdx + 2] = tempColor.b;
            spawnedCount++;
          }
        }
      }

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
          
          const lifeRatio = Math.max(0, lifetimes[i] / initialLifetimes[i]);
          const fadeFactor = Math.pow(lifeRatio, 0.5); // Eased fade

          colors[pIdx + 0] *= fadeFactor; // Dim by multiplying existing color
          colors[pIdx + 1] *= fadeFactor;
          colors[pIdx + 2] *= fadeFactor;
          // To actually fade alpha, material.opacity needs to be vertex-driven or particles individually managed
          // For now, fading color to black approximates opacity with AdditiveBlending.

          if (lifetimes[i] <= 0) {
            positions[pIdx] = positions[pIdx + 1] = positions[pIdx + 2] = 10000; // Effectively "kill" particle
          }
        }
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.color.needsUpdate = true;

      webGLAssets.particleMaterial.size = Math.max(1.5, 3.0 + settings.brightCap * 3 + audioData.rms * 4);
      webGLAssets.particleMaterial.opacity = Math.min(0.9, 0.6 + settings.brightCap * 0.4 + audioData.rms * 0.4);

      // Subtle camera adjustments
      const targetZ = 350 - audioData.rms * 100 - (audioData.beat ? 20 : 0);
      camera.position.z += (targetZ - camera.position.z) * 0.05;
      const targetFov = 75 - audioData.rms * 15 - (audioData.beat ? 5 : 0);
      camera.fov += (targetFov - camera.fov) * 0.05;
      camera.updateProjectionMatrix();

      particles.rotation.y += audioData.midEnergy * 0.001 + 0.0002;
      particles.rotation.x += audioData.trebleEnergy * 0.0008 + 0.0001;
    },
    cleanupWebGL: (webGLAssets) => {
      webGLAssets.particleGeometry?.dispose();
      webGLAssets.particleMaterial?.dispose();
    },
  },
];

export const CONTROL_PANEL_WIDTH_STRING = "280px";
