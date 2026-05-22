// Model loading and normalization
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Load a GLTF model with progress tracking
 */
function loadGLTF(url, manager) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader(manager);
    loader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Center and normalize a model to fit within a reasonable size
 */
function normalizeModel(model, targetSize = 10) {
  model.updateMatrixWorld(true);
  
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = targetSize / maxDim;

  // Create wrapper group
  const wrapper = new THREE.Group();
  
  // Offset model so center is at origin
  model.position.set(-center.x, -center.y, -center.z);
  wrapper.add(model);
  wrapper.scale.setScalar(scale);
  wrapper.updateMatrixWorld(true);

  // Place on ground
  const box2 = new THREE.Box3().setFromObject(wrapper);
  wrapper.position.y -= box2.min.y;

  return wrapper;
}

/**
 * Collect all mesh materials from a model
 */
function collectMaterials(model) {
  const materials = [];
  model.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        materials.push(...child.material);
      } else {
        materials.push(child.material);
      }
    }
  });
  return materials;
}

/**
 * Inject custom shader code into all materials of a model
 * This modifies the onBeforeCompile to add reveal logic
 */
export function setupRevealMaterials(model, isReconstruction, revealUniforms) {
  model.traverse((child) => {
    if (!child.isMesh) return;
    
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    
    materials.forEach(mat => {
      mat.transparent = true;
      mat.depthWrite = true;
      mat.needsUpdate = true;
      
      // Store reference for uniform updates
      mat.userData.revealUniforms = revealUniforms;
      mat.userData.isReconstruction = isReconstruction;
      
      mat.customProgramCacheKey = () => {
        return (isReconstruction ? 'recon_' : 'ruin_') + (mat.name || mat.uuid);
      };
      
      mat.onBeforeCompile = (shader) => {
        // Add custom uniforms
        shader.uniforms.uMouseNDC = revealUniforms.uMouseNDC;
        shader.uniforms.uCameraWorldPos = revealUniforms.uCameraWorldPos;
        shader.uniforms.uRayDirection = revealUniforms.uRayDirection;
        shader.uniforms.uRevealCenterWorld = revealUniforms.uRevealCenterWorld;
        shader.uniforms.uRevealHasHit = revealUniforms.uRevealHasHit;
        shader.uniforms.uWorldRadius = revealUniforms.uWorldRadius;
        shader.uniforms.uWorldSoftness = revealUniforms.uWorldSoftness;
        shader.uniforms.uViewportSize = revealUniforms.uViewportSize;
        shader.uniforms.uRevealRadius = revealUniforms.uRevealRadius;
        shader.uniforms.uRevealSoftness = revealUniforms.uRevealSoftness;
        shader.uniforms.uRevealActive = revealUniforms.uRevealActive;
        shader.uniforms.uShowAlways = revealUniforms.uShowAlways;
        shader.uniforms.uLensZoom = revealUniforms.uLensZoom;
        shader.uniforms.uTime = revealUniforms.uTime;
        shader.uniforms.uOpacityRuin = revealUniforms.uOpacityRuin;
        shader.uniforms.uOpacityRecon = revealUniforms.uOpacityRecon;
        shader.uniforms.uPortalTint = revealUniforms.uPortalTint;
        
        // Pass world position and uniform data from vertex shader
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPosition;
          uniform vec2 uMouseNDC;
          uniform vec2 uViewportSize;
          uniform float uRevealRadius;
          uniform float uRevealSoftness;
          uniform float uLensZoom;
          uniform bool uRevealActive;
          uniform bool uShowAlways;`
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
          
          // Magnifying lens effect in vertex shader
          if (uRevealActive && !uShowAlways && uLensZoom > 1.0) {
            vec2 aspect = vec2(uViewportSize.x / uViewportSize.y, 1.0);
            vec2 ndcPos = gl_Position.xy / gl_Position.w;
            vec2 dir = (ndcPos - uMouseNDC) * aspect;
            float dist = length(dir);
            float radius = uRevealRadius; // screen-space radius relative to height
            
            if (dist < radius) {
              float normalizedDist = dist / radius;
              // Smooth transition to avoid tearing at the boundaries
              float t = smoothstep(0.0, 1.0, normalizedDist);
              float zoom = mix(uLensZoom, 1.0, t);
              
              // Scale the NDC position relative to the mouse cursor
              vec2 newNdcPos = uMouseNDC + (ndcPos - uMouseNDC) / zoom;
              gl_Position.xy = newNdcPos * gl_Position.w;
            }
          }`
        );
        
        // Add uniforms & varying to fragment shader
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
          uniform vec2 uMouseNDC;
          uniform vec3 uCameraWorldPos;
          uniform vec3 uRayDirection;
          uniform vec3 uRevealCenterWorld;
          uniform bool uRevealHasHit;
          uniform float uWorldRadius;
          uniform float uWorldSoftness;
          uniform vec2 uViewportSize;
          uniform float uRevealRadius;
          uniform float uRevealSoftness;
          uniform float uLensZoom;
          uniform bool uRevealActive;
          uniform bool uShowAlways;
          uniform float uTime;
          uniform float uOpacityRuin;
          uniform float uOpacityRecon;
          uniform float uPortalTint;
          varying vec3 vWorldPosition;`
        );
        
        // Add discard logic and transition effects at the end of fragment shader
        if (isReconstruction) {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            gl_FragColor.a = uOpacityRecon; // Set reconstruction opacity
            if (uShowAlways) {
              vec3 portalTint = vec3(1.0, 0.72, 0.32);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, portalTint, 0.26 * uPortalTint);
            } else if (uRevealActive) {
              // 3D spatial reveal
              float reveal3D = 0.0;
              if (uRevealHasHit) {
                float dist3D = distance(vWorldPosition, uRevealCenterWorld);
                reveal3D = 1.0 - smoothstep(uWorldRadius - uWorldSoftness, uWorldRadius + uWorldSoftness, dist3D);
              }

              // 2D screen-space reveal (Lupeneffekt)
              vec2 mousePixel = (uMouseNDC * 0.5 + 0.5) * uViewportSize;
              float dist2D = distance(gl_FragCoord.xy, mousePixel);
              float radius2D = uRevealRadius * uViewportSize.y * 0.5;
              float softness2D = uRevealSoftness * uViewportSize.y * 0.5;
              float reveal2D = 1.0 - smoothstep(radius2D - softness2D, radius2D + softness2D, dist2D);

              // Combined reveal
              float finalReveal = max(reveal3D, reveal2D);

              // Edge highlight
              float edge3D = 0.0;
              if (uRevealHasHit) {
                edge3D = smoothstep(uWorldRadius - uWorldSoftness * 2.0, uWorldRadius, distance(vWorldPosition, uRevealCenterWorld)) * reveal3D;
              }
              float edge2D = smoothstep(radius2D - softness2D * 2.0, radius2D, dist2D) * reveal2D;
              float finalEdge = max(edge3D, edge2D);

              vec3 portalTint = vec3(1.0, 0.72, 0.32);
              gl_FragColor.rgb = mix(gl_FragColor.rgb * 1.12, portalTint, 0.20 * finalReveal + 0.35 * finalEdge);
              gl_FragColor.a *= finalReveal;
            } else {
              discard;
            }
            if (gl_FragColor.a < 0.01) discard;`
          );
        } else {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            gl_FragColor.a = uOpacityRuin; // Set ruin opacity
            if (uRevealActive) {
              // 3D spatial cutout
              float cutout3D = 0.0;
              if (uRevealHasHit) {
                float dist3D = distance(vWorldPosition, uRevealCenterWorld);
                cutout3D = 1.0 - smoothstep(uWorldRadius - uWorldSoftness, uWorldRadius + uWorldSoftness, dist3D);
              }

              // 2D screen-space cutout (Lupeneffekt)
              vec2 mousePixel = (uMouseNDC * 0.5 + 0.5) * uViewportSize;
              float dist2D = distance(gl_FragCoord.xy, mousePixel);
              float radius2D = uRevealRadius * uViewportSize.y * 0.5;
              float softness2D = uRevealSoftness * uViewportSize.y * 0.5;
              float cutout2D = 1.0 - smoothstep(radius2D - softness2D, radius2D + softness2D, dist2D);

              // Combined cutout
              float finalCutout = max(cutout3D, cutout2D);

              gl_FragColor.a *= 1.0 - finalCutout;
            }
            if (gl_FragColor.a < 0.01) discard;`
          );
        }

        // Diagnostic verification
        if (shader.vertexShader.indexOf('vWorldPosition') !== -1) {
          console.log(`[Shader Check] Vertex replacement succeeded for ${isReconstruction ? "reconstruction" : "ruin"} material:`, mat.name || mat.uuid);
        } else {
          console.error(`[Shader Check] Vertex replacement FAILED for ${isReconstruction ? "reconstruction" : "ruin"} material:`, mat.name || mat.uuid);
        }

        if (shader.fragmentShader.indexOf('uRevealActive') !== -1) {
          console.log(`[Shader Check] Fragment replacement succeeded for ${isReconstruction ? "reconstruction" : "ruin"} material:`, mat.name || mat.uuid);
        } else {
          console.error(`[Shader Check] Fragment replacement FAILED for ${isReconstruction ? "reconstruction" : "ruin"} material:`, mat.name || mat.uuid);
        }
      };
    });
  });
}

/**
 * Load both models and return them
 */
export async function loadModels(scene, onProgress) {
  const manager = new THREE.LoadingManager();

  manager.onStart = () => {
    onProgress?.(0.03);
  };

  manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
    if (itemsTotal > 0) {
      onProgress?.(itemsLoaded / itemsTotal);
    }
  };

  const [ruinGltf, reconGltf] = await Promise.all([
    loadGLTF('/the_heidentor_in_petronell-carnuntum/scene.gltf', manager),
    loadGLTF('/reconstruction_of_the_heidentor/scene.gltf', manager)
  ]);

  onProgress?.(1);

  const ruinWrapper = normalizeModel(ruinGltf.scene);
  
  // Rotate reconstruction model 90 degrees around X to stand upright (Z-up to Y-up)
  reconGltf.scene.rotation.x = -Math.PI / 2;
  const reconWrapper = normalizeModel(reconGltf.scene);

  scene.add(ruinWrapper);
  scene.add(reconWrapper);

  return {
    ruinModel: ruinWrapper,
    reconModel: reconWrapper
  };
}
