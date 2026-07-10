import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

import { createSkyDome, createGrassPlane, createLighting } from './src/environment.js';
import { loadModels, setupRevealMaterials } from './src/models.js';
import { computeAlignmentMatrix, saveAlignment, loadAlignment, clearAlignment, matrixToAlignment, alignmentToMatrix } from './src/alignment.js';
import { loadDraftStations, loadStationConfig } from './src/stations.js';

import { ctx } from './src/three/context.js';
import { setupStateBridge } from './src/three/stateBridge.js';
import { initStationImages, updateStationImages } from './src/three/imagePlanes.js';
import {
  getPortalTransitionConfig,
  computeTransitionState,
  isPortalRevealTransition,
  applyTransitionState,
  startPortalTransition,
  cancelPortalTransition,
  configureReconstructionDepth
} from './src/three/portalTransition.js';
import { playInitialIntro } from './src/three/introSequence.js';
import { animate } from './src/three/renderLoop.js';

// ─── DOM & CANVAS ─────────────────────────────────────
const canvas = document.getElementById('scene-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingPercent = document.getElementById('loading-percent');

let displayedLoadingProgress = 0;
let targetLoadingProgress = 0.03;
let loadingComplete = false;

function renderLoadingProgress(progress) {
  const pct = Math.round(THREE.MathUtils.clamp(progress, 0, 1) * 100);
  if (loadingBar) loadingBar.style.width = pct + '%';
  if (loadingPercent) loadingPercent.textContent = pct + '%';
}

const loadingProgressTimer = window.setInterval(() => {
  if (!loadingComplete) {
    targetLoadingProgress = Math.min(targetLoadingProgress + 0.006, 0.92);
  }
  displayedLoadingProgress = THREE.MathUtils.lerp(displayedLoadingProgress, targetLoadingProgress, 0.12);
  renderLoadingProgress(displayedLoadingProgress);
}, 100);

// ─── RENDERER ─────────────────────────────────────────
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} catch (error) {
  console.error("WebGL Initialization failed:", error);
  if (loadingPercent) {
    loadingPercent.innerHTML = '<span style="color: #ff5252; font-weight: 600; display: block; max-width: 400px; margin: 10px auto; line-height: 1.5; font-size: 13px;">WebGL-Fehler: Der WebGL-Kontext konnte nicht erstellt werden.<br>Grafikbeschleunigung wurde blockiert oder ist inaktiv. Bitte starten Sie Ihren Browser vollständig neu oder öffnen Sie diese Seite an einem anderen Port (z.B. localhost:3005).</span>';
  }
  const loadingSubtitle = document.querySelector('.loading-subtitle');
  if (loadingSubtitle) {
    loadingSubtitle.textContent = '3D-Engine konnte nicht gestartet werden.';
  }
  throw error;
}

// ─── SCENE & CAMERA ──────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x010101, 0.019);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 22);

// ─── CONTROLS ─────────────────────────────────────────
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.minDistance = 0.5;
controls.maxDistance = 75;
controls.target.set(0, 3.5, 0);

let autoRotateTimer = null;

function pauseAutoRotate() {
  controls.autoRotate = false;
  clearTimeout(autoRotateTimer);
  autoRotateTimer = setTimeout(() => {
    if (ctx.isRevealMode && window.appState?.stationMode !== 'editor' && controls.enabled) {
      controls.autoRotate = true;
    }
  }, 5000);
}

canvas.addEventListener('pointerdown', () => {
  pauseAutoRotate();
  if (controls.enabled && !window.appState?.hasUserManipulatedCamera) {
    window.appState?.update({ hasUserManipulatedCamera: true });
  }
});

canvas.addEventListener('wheel', () => {
  pauseAutoRotate();
  if (controls.enabled && !window.appState?.hasUserManipulatedCamera) {
    window.appState?.update({ hasUserManipulatedCamera: true });
  }
});

// Bind to context
ctx.canvas = canvas;
ctx.renderer = renderer;
ctx.scene = scene;
ctx.camera = camera;
ctx.controls = controls;

ctx.skyMaterial = createSkyDome(scene);
ctx.grassObj = createGrassPlane(scene);
ctx.lights = createLighting(scene);
scene.add(ctx.lights.keyLight.target);
scene.add(ctx.lights.fillLight.target);

renderer.getDrawingBufferSize(ctx.revealUniforms.uViewportSize.value);

// Bind actions
ctx.actions.startAlignmentMode = startAlignmentMode;
ctx.actions.handleAlignClick = handleAlignClick;
ctx.actions.completeAlignment = completeAlignment;
ctx.actions.enterRevealMode = enterRevealMode;
ctx.actions.updateStationImages = updateStationImages;
ctx.actions.updateScrollProgress = updateScrollProgress;
ctx.actions.applyScrollProgress = applyScrollProgress;
ctx.actions.clearMarkers = clearMarkers;
ctx.actions.clearLines = clearLines;
ctx.actions.getPortalTransitionConfig = getPortalTransitionConfig;
ctx.actions.computeTransitionState = computeTransitionState;
ctx.actions.isPortalRevealTransition = isPortalRevealTransition;
ctx.actions.applyTransitionState = applyTransitionState;
ctx.actions.startPortalTransition = startPortalTransition;
ctx.actions.cancelPortalTransition = cancelPortalTransition;
ctx.actions.playInitialIntro = playInitialIntro;

initStationImages();

function syncScrollControlsForStation(station) {
  if (window.appState.stationMode !== 'scroll') return;

  const canNavigateFreely = !!station?.freeNavigation;
  controls.enabled = canNavigateFreely;
  controls.autoRotate = false;

  if (!canNavigateFreely && window.appState.hasUserManipulatedCamera) {
    window.appState.update({ hasUserManipulatedCamera: false });
  }
}

// ─── LOADING & INITIALIZATION ─────────────────────────
async function init() {
  try {
    const result = await loadModels(scene, (progress) => {
      targetLoadingProgress = Math.max(targetLoadingProgress, progress);
    });

    ctx.ruinModel = result.ruinModel;
    ctx.reconModel = result.reconModel;

    // Capture artist-defined normalized height offsets
    ctx.ruinOffsetY = ctx.ruinModel.position.y;
    ctx.reconOffsetY = ctx.reconModel.position.y;

    // Enable shadows on models
    ctx.ruinModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    ctx.reconModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

    // Setup reveal materials & inject uniforms
    setupRevealMaterials(ctx.ruinModel, false, ctx.revealUniforms);
    setupRevealMaterials(ctx.reconModel, true, ctx.revealUniforms);

    // Warm up/pre-compile shaders and upload textures to the GPU during the loading phase
    // to prevent any stutter/lag when the models first become visible.
    ctx.ruinModel.visible = true;
    ctx.reconModel.visible = true;
    renderer.compile(scene, camera);
    ctx.ruinModel.visible = false;
    ctx.reconModel.visible = false;
    ctx.revealHitMeshes = collectRevealHitMeshes(ctx.reconModel);

    // Bind state bridge
    setupStateBridge();

    // Load stations from localStorage or the editable JSON file
    const config = await loadStationConfig();
    const isEditPage = window.location.pathname === '/edits';
    const initialStations = isEditPage ? (loadDraftStations() ?? config.stations) : config.stations;

    window.appState.update({
      stations: initialStations,
      alignment: config.alignment
    });

    // Check for saved alignment with default config alignment as fallback
    const savedMatrix = loadAlignment(config.alignment);
    if (savedMatrix) {
      ctx.reconModel.applyMatrix4(savedMatrix);
      ctx.reconModel.updateMatrixWorld(true);
      ctx.isModelAligned = true;
      window.appState.update({ alignment: matrixToAlignment(savedMatrix) });
      finishLoading(false);
    } else {
      finishLoading(true);
    }
  } catch (error) {
    console.error("Initialization failed:", error);
    clearInterval(loadingProgressTimer);
    if (loadingPercent) {
      loadingPercent.innerHTML = `<span style="color: #ff5252; font-weight: 600;">Fehler beim Laden der 3D-Modelle: ${error.message}</span>`;
    }
  }
}

function finishLoading(showAlignment) {
  loadingComplete = true;
  clearInterval(loadingProgressTimer);
  renderLoadingProgress(1.0);

  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.pointerEvents = 'none';
    }
    if (showAlignment) {
      startAlignmentMode();
    } else {
      enterRevealMode();
    }
  }, 400);
}

function collectRevealHitMeshes(model) {
  const modelBox = new THREE.Box3().setFromObject(model);
  const modelHeight = Math.max(modelBox.max.y - modelBox.min.y, 0.0001);
  const pickMeshes = [];

  model.traverse((child) => {
    if (!child.isMesh) return;
    const box = new THREE.Box3().setFromObject(child);
    const size = box.getSize(new THREE.Vector3());
    const relativeHeight = size.y / modelHeight;
    const bottomOffset = (box.max.y - modelBox.min.y) / modelHeight;

    if (relativeHeight < 0.04 || bottomOffset < 0.08) {
      return;
    }
    pickMeshes.push(child);
  });
  return pickMeshes;
}


// ─── ALIGNMENT MODE ──────────────────────────────────
function startAlignmentMode() {
  window.appState.update({
    mode: 'aligning',
    alignStep: 0,
    alignTarget: 'ruin'
  });

  ctx.isRevealMode = false;
  controls.autoRotate = false;

  ctx.ruinModel.position.set(0, ctx.ruinOffsetY, 0);
  ctx.reconModel.position.set(0, ctx.reconOffsetY, 0);

  ctx.ruinModel.visible = true;
  ctx.reconModel.visible = false;

  ctx.revealUniforms.uRevealActive.value = false;
  ctx.revealUniforms.uShowAlways.value = true;

  controls.target.set(0, 3.5, 0);
  camera.position.set(10, 7.5, 14);

  window.appState.resetAlignment();
}

function handleAlignClick(event) {
  if (window.appState.mode !== 'aligning') return;

  const rect = canvas.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  ctx.raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

  const isRuinTurn = window.appState.alignTarget === 'ruin';
  const targetModel = isRuinTurn ? ctx.ruinModel : ctx.reconModel;
  const intersects = ctx.raycaster.intersectObject(targetModel, true);

  if (intersects.length === 0) return;

  const worldPoint = intersects[0].point.clone();
  const localPoint = targetModel.worldToLocal(worldPoint.clone());

  if (isRuinTurn) {
    ctx.alignPoints.ruin.push(localPoint);
    ctx.alignPoints.ruinWorld.push(worldPoint);
    addMarker(worldPoint, 'ruin');

    const nextStep = window.appState.alignStep + 1;
    if (nextStep === 3) {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'recon'
      });
      ctx.ruinModel.visible = false;
      ctx.alignMarkers.forEach(m => { if (m.userData.type === 'ruin') m.visible = false; });
      ctx.reconModel.visible = true;
    } else {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'ruin'
      });
    }
  } else {
    ctx.alignPoints.recon.push(localPoint);
    ctx.alignPoints.reconWorld.push(worldPoint);
    addMarker(worldPoint, 'recon');

    const nextStep = window.appState.alignStep + 1;
    if (nextStep === 6) {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'done'
      });
      setTimeout(completeAlignment, 700);
    } else {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'recon'
      });
    }
  }
}

function addMarker(worldPos, type) {
  const geo = new THREE.SphereGeometry(0.12, 16, 16);
  const color = type === 'ruin' ? 0xffa726 : 0x6ef0f5;
  const mat = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity: 0.9
  });
  const sphere = new THREE.Mesh(geo, mat);
  sphere.renderOrder = 999;
  sphere.position.copy(worldPos);
  sphere.userData = { type };
  scene.add(sphere);
  ctx.alignMarkers.push(sphere);
}

function clearMarkers() {
  ctx.alignMarkers.forEach(m => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  ctx.alignMarkers.length = 0;
}

function clearLines() {
  ctx.alignLines.forEach(l => {
    scene.remove(l);
    l.geometry.dispose();
    l.material.dispose();
  });
  ctx.alignLines.length = 0;
}

function completeAlignment() {
  const matrix = computeAlignmentMatrix(ctx.alignPoints.reconWorld, ctx.alignPoints.ruinWorld);

  if (matrix) {
    ctx.reconModel.applyMatrix4(matrix);
    ctx.reconModel.updateMatrixWorld(true);
    saveAlignment(matrix);
    window.appState.update({ alignment: matrixToAlignment(matrix) });
    ctx.isModelAligned = true;
  }

  clearMarkers();

  ctx.ruinModel.visible = true;
  ctx.reconModel.visible = true;

  ctx.reconModel.traverse((child) => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { m.opacity = 1.0; m.transparent = true; m.needsUpdate = true; });
    }
  });

  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);

  ctx.revealUniforms.uRevealActive.value = true;
  ctx.revealUniforms.uCameraWorldPos.value.copy(camera.position);
  const modelCenter = new THREE.Vector3(0, ctx.ruinOffsetY, 0);
  ctx.revealUniforms.uRayDirection.value.subVectors(modelCenter, camera.position).normalize();
  ctx.revealUniforms.uRevealCenterWorld.value.copy(modelCenter);
  ctx.revealUniforms.uRevealHasHit.value = true;
  ctx.revealUniforms.uMouseNDC.value.set(0, 0);
  ctx.revealUniforms.uRevealRadius.value = 0.0;
  ctx.revealUniforms.uRevealSoftness.value = 0.15;

  const tl = gsap.timeline({
    onComplete: () => {
      enterRevealMode();
    }
  });

  tl.to(ctx.revealUniforms.uRevealRadius, {
    value: 1.8,
    duration: 2.5,
    ease: 'power2.inOut'
  });

  tl.to(ctx.revealUniforms.uRevealRadius, {
    value: 0.26,
    duration: 1.2,
    ease: 'power2.out'
  });

  tl.to(ctx.revealUniforms.uRevealSoftness, {
    value: 0.05,
    duration: 0.8
  }, '-=1.2');

  gsap.to(controls.target, {
    x: 0,
    y: 3.5,
    z: 0,
    duration: 2.2,
    ease: 'power3.inOut'
  });

  gsap.to(camera.position, {
    x: 11,
    y: 6.5,
    z: 14,
    duration: 2.2,
    ease: 'power3.inOut'
  });
}

// ─── REVEAL / EXPLORE MODE ──────────────────────────
function enterRevealMode() {
  console.log("Entering reveal mode!");
  ctx.isRevealMode = true;
  const shouldPlayIntro = !window.appState.hasIntroPlayed && window.location.pathname !== '/edits';

  if (shouldPlayIntro) {
    ctx.introModelOpacity.value = 0;
  } else {
    ctx.introModelOpacity.value = 1;
  }

  ctx.ruinModel.position.set(0, ctx.ruinOffsetY, 0);
  if (!ctx.isModelAligned) {
    ctx.reconModel.position.set(0, ctx.reconOffsetY, 0);
  }

  ctx.revealUniforms.uRevealActive.value = true;
  ctx.revealUniforms.uShowAlways.value = false;
  ctx.revealUniforms.uRevealHasHit.value = false;
  ctx.revealUniforms.uRevealCenterWorld.value.set(9999, 9999, 9999);

  ctx.reconModel.traverse((child) => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { m.opacity = 1.0; m.transparent = true; m.needsUpdate = true; });
    }
  });

  ctx.ruinModel.visible = true;
  ctx.reconModel.visible = true;
  configureReconstructionDepth(false);

  if (window.appState.stations && window.appState.stations.length > 0) {
    const first = window.appState.stations[0];
    camera.position.set(first.cameraPos.x, first.cameraPos.y, first.cameraPos.z);
    controls.target.set(first.cameraTarget.x, first.cameraTarget.y, first.cameraTarget.z);
    ctx.targetCameraPos.copy(camera.position);
    ctx.targetCameraTarget.copy(controls.target);
    
    ctx.revealUniforms.uRevealRadius.value = first.revealRadius;
    ctx.revealUniforms.uRevealSoftness.value = first.revealSoftness;
    ctx.targetRevealRadius = first.revealRadius;
    ctx.targetRevealSoftness = first.revealSoftness;

    ctx.targetLightIntensity = first.lightIntensity ?? 1.0;
    ctx.targetShadowDiffuse = first.shadowDiffuse ?? 1.0;
    ctx.currentLightIntensity = ctx.targetLightIntensity;
    ctx.currentShadowDiffuse = ctx.targetShadowDiffuse;

    ctx.targetHemiEnabled = (first.lightHemiEnabled ?? true) ? 1.0 : 0.0;
    ctx.currentHemiEnabled = ctx.targetHemiEnabled;
    ctx.targetKeyEnabled = (first.lightKeyEnabled ?? true) ? 1.0 : 0.0;
    ctx.currentKeyEnabled = ctx.targetKeyEnabled;
    ctx.targetFillEnabled = (first.lightFillEnabled ?? true) ? 1.0 : 0.0;
    ctx.currentFillEnabled = ctx.targetFillEnabled;
    ctx.targetSpotEnabled = (first.lightSpotEnabled ?? true) ? 1.0 : 0.0;
    ctx.currentSpotEnabled = ctx.targetSpotEnabled;

    ctx.targetKeyFixedToCamera = !!first.lightKeyFixedToCamera;
    ctx.currentKeyFixedToCamera = ctx.targetKeyFixedToCamera;
    ctx.targetFillFixedToCamera = !!first.lightFillFixedToCamera;
    ctx.currentFillFixedToCamera = ctx.targetFillFixedToCamera;
    ctx.targetSpotFixedToCamera = !!first.lightSpotFixedToCamera;
    ctx.currentSpotFixedToCamera = ctx.targetSpotFixedToCamera;

    ctx.targetKeyPos.set(first.lightKeyPos?.x ?? 8, first.lightKeyPos?.y ?? 16, first.lightKeyPos?.z ?? 10);
    ctx.currentKeyPos.copy(ctx.targetKeyPos);
    ctx.targetFillPos.set(first.lightFillPos?.x ?? -8, first.lightFillPos?.y ?? 12, first.lightFillPos?.z ?? -10);
    ctx.currentFillPos.copy(ctx.targetFillPos);
    ctx.targetSpotPos.set(first.lightSpotPos?.x ?? 0, first.lightSpotPos?.y ?? 15, first.lightSpotPos?.z ?? 0);
    ctx.currentSpotPos.copy(ctx.targetSpotPos);

    updateStationImages(first.images);

    ctx.lastIntervalIndex = 0;
    ctx.lastTargetP = 0.0;
    ctx.transitionProgress.value = 0.0;
    if (ctx.scrollTransitionTween) {
      ctx.scrollTransitionTween.kill();
      ctx.scrollTransitionTween = null;
    }

    window.appState.update({
      mode: 'reveal',
      stationMode: 'scroll',
      viewMode: first.viewMode,
      scrollProgress: 0,
      currentStationIndex: 0,
      lightIntensity: ctx.targetLightIntensity,
      shadowDiffuse: ctx.targetShadowDiffuse,
      introPhase: shouldPlayIntro ? 'title' : 'done'
    });
    window.appState.setViewMode(first.viewMode);
  } else {
    window.appState.update({
      mode: 'reveal',
      stationMode: 'scroll',
      viewMode: 'reveal',
      scrollProgress: 0,
      currentStationIndex: 0,
      introPhase: shouldPlayIntro ? 'title' : 'done'
    });
  }

  if (shouldPlayIntro) {
    ctx.revealUniforms.uOpacityRuin.value = 0;
    ctx.revealUniforms.uOpacityRecon.value = 0;
    ctx.revealUniforms.uPortalTint.value = 0;
  }

  syncScrollControlsForStation(window.appState.stations?.[0]);
  controls.autoRotate = false;

  if (shouldPlayIntro) {
    playInitialIntro();
  }
}

// ─── SCROLL PROGRESS LOGIC ────────────────────────────
function updateScrollProgress(progress) {
  const clampedProgress = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  window.appState.update({ scrollProgress: clampedProgress });
}

function applyScrollProgress(progress) {
  const clampedProgress = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  const scrollingForward = clampedProgress >= ctx.previousScrollProgress;

  const stations = window.appState.stations || [];
  const N = stations.length;
  if (N === 0) return;
  if (N === 1) {
    const onlyStation = stations[0];
    ctx.targetCameraPos.set(onlyStation.cameraPos.x, onlyStation.cameraPos.y, onlyStation.cameraPos.z);
    ctx.targetCameraTarget.set(onlyStation.cameraTarget.x, onlyStation.cameraTarget.y, onlyStation.cameraTarget.z);
    ctx.targetRevealRadius = onlyStation.revealRadius;
    ctx.targetRevealSoftness = onlyStation.revealSoftness;
    ctx.targetLightIntensity = onlyStation.lightIntensity ?? 1.0;
    ctx.targetShadowDiffuse = onlyStation.shadowDiffuse ?? 1.0;
    ctx.targetHemiEnabled = (onlyStation.lightHemiEnabled ?? true) ? 1.0 : 0.0;
    ctx.targetKeyEnabled = (onlyStation.lightKeyEnabled ?? true) ? 1.0 : 0.0;
    ctx.targetFillEnabled = (onlyStation.lightFillEnabled ?? true) ? 1.0 : 0.0;
    ctx.targetSpotEnabled = (onlyStation.lightSpotEnabled ?? true) ? 1.0 : 0.0;
    ctx.targetKeyFixedToCamera = !!onlyStation.lightKeyFixedToCamera;
    ctx.targetFillFixedToCamera = !!onlyStation.lightFillFixedToCamera;
    ctx.targetSpotFixedToCamera = !!onlyStation.lightSpotFixedToCamera;

    ctx.targetKeyPos.set(onlyStation.lightKeyPos?.x ?? 8, onlyStation.lightKeyPos?.y ?? 16, onlyStation.lightKeyPos?.z ?? 10);
    ctx.targetFillPos.set(onlyStation.lightFillPos?.x ?? -8, onlyStation.lightFillPos?.y ?? 12, onlyStation.lightFillPos?.z ?? -10);
    ctx.targetSpotPos.set(onlyStation.lightSpotPos?.x ?? 0, onlyStation.lightSpotPos?.y ?? 15, onlyStation.lightSpotPos?.z ?? 0);

    if (window.appState.viewMode !== onlyStation.viewMode) {
      window.appState.setViewMode(onlyStation.viewMode);
    }
    if (window.appState.currentStationIndex !== 0) {
      window.appState.update({ currentStationIndex: 0 });
    }
    syncScrollControlsForStation(onlyStation);
    return;
  }

  const normProgress = clampedProgress;
  const totalIntervals = N - 1;
  const scaledProgress = normProgress * totalIntervals;
  const index = Math.min(Math.floor(scaledProgress), N - 2);
  const nextIndex = index + 1;
  const tRaw = THREE.MathUtils.clamp(scaledProgress - index, 0, 1);

  const t = THREE.MathUtils.smoothstep(tRaw, 0, 1);

  const currentStation = stations[index];
  const nextStation = stations[nextIndex];
  const transitionConfig = getPortalTransitionConfig(currentStation, nextStation);
  const portalRevealTransition = isPortalRevealTransition(currentStation.viewMode, nextStation.viewMode);
  const scrollDrivenPortalTransition =
    !portalRevealTransition &&
    (currentStation.viewMode === 'portal' || nextStation.viewMode === 'portal');

  ctx.targetCameraPos.set(
    THREE.MathUtils.lerp(currentStation.cameraPos.x, nextStation.cameraPos.x, t),
    THREE.MathUtils.lerp(currentStation.cameraPos.y, nextStation.cameraPos.y, t),
    THREE.MathUtils.lerp(currentStation.cameraPos.z, nextStation.cameraPos.z, t)
  );

  ctx.targetCameraTarget.set(
    THREE.MathUtils.lerp(currentStation.cameraTarget.x, nextStation.cameraTarget.x, t),
    THREE.MathUtils.lerp(currentStation.cameraTarget.y, nextStation.cameraTarget.y, t),
    THREE.MathUtils.lerp(currentStation.cameraTarget.z, nextStation.cameraTarget.z, t)
  );

  ctx.targetLightIntensity = THREE.MathUtils.lerp(
    currentStation.lightIntensity ?? 1.0,
    nextStation.lightIntensity ?? 1.0,
    t
  );
  ctx.targetShadowDiffuse = THREE.MathUtils.lerp(
    currentStation.shadowDiffuse ?? 1.0,
    nextStation.shadowDiffuse ?? 1.0,
    t
  );

  ctx.targetHemiEnabled = THREE.MathUtils.lerp(
    (currentStation.lightHemiEnabled ?? true) ? 1.0 : 0.0,
    (nextStation.lightHemiEnabled ?? true) ? 1.0 : 0.0,
    t
  );
  ctx.targetKeyEnabled = THREE.MathUtils.lerp(
    (currentStation.lightKeyEnabled ?? true) ? 1.0 : 0.0,
    (nextStation.lightKeyEnabled ?? true) ? 1.0 : 0.0,
    t
  );
  ctx.targetFillEnabled = THREE.MathUtils.lerp(
    (currentStation.lightFillEnabled ?? true) ? 1.0 : 0.0,
    (nextStation.lightFillEnabled ?? true) ? 1.0 : 0.0,
    t
  );
  ctx.targetSpotEnabled = THREE.MathUtils.lerp(
    (currentStation.lightSpotEnabled ?? true) ? 1.0 : 0.0,
    (nextStation.lightSpotEnabled ?? true) ? 1.0 : 0.0,
    t
  );

  ctx.targetKeyFixedToCamera = t < 0.5 ? !!currentStation.lightKeyFixedToCamera : !!nextStation.lightKeyFixedToCamera;
  ctx.targetFillFixedToCamera = t < 0.5 ? !!currentStation.lightFillFixedToCamera : !!nextStation.lightFillFixedToCamera;
  ctx.targetSpotFixedToCamera = t < 0.5 ? !!currentStation.lightSpotFixedToCamera : !!nextStation.lightSpotFixedToCamera;

  ctx.targetKeyPos.set(
    THREE.MathUtils.lerp(currentStation.lightKeyPos?.x ?? 8, nextStation.lightKeyPos?.x ?? 8, t),
    THREE.MathUtils.lerp(currentStation.lightKeyPos?.y ?? 16, nextStation.lightKeyPos?.y ?? 16, t),
    THREE.MathUtils.lerp(currentStation.lightKeyPos?.z ?? 10, nextStation.lightKeyPos?.z ?? 10, t)
  );
  ctx.targetFillPos.set(
    THREE.MathUtils.lerp(currentStation.lightFillPos?.x ?? -8, nextStation.lightFillPos?.x ?? -8, t),
    THREE.MathUtils.lerp(currentStation.lightFillPos?.y ?? 12, nextStation.lightFillPos?.y ?? 12, t),
    THREE.MathUtils.lerp(currentStation.lightFillPos?.z ?? -10, nextStation.lightFillPos?.z ?? -10, t)
  );
  ctx.targetSpotPos.set(
    THREE.MathUtils.lerp(currentStation.lightSpotPos?.x ?? 0, nextStation.lightSpotPos?.x ?? 0, t),
    THREE.MathUtils.lerp(currentStation.lightSpotPos?.y ?? 15, nextStation.lightSpotPos?.y ?? 15, t),
    THREE.MathUtils.lerp(currentStation.lightSpotPos?.z ?? 0, nextStation.lightSpotPos?.z ?? 0, t)
  );

  if (portalRevealTransition) {
    if (ctx.scrollTransitionTween) {
      ctx.scrollTransitionTween.kill();
      ctx.scrollTransitionTween = null;
    }

    const targetPortalProgress = scrollingForward
      ? (tRaw > 0.02 ? 1 : 0)
      : (tRaw > 0.98 ? 1 : 0);

    startPortalTransition(
      currentStation.viewMode,
      nextStation.viewMode,
      currentStation.revealRadius,
      currentStation.revealSoftness,
      nextStation.revealRadius,
      nextStation.revealSoftness,
      targetPortalProgress,
      transitionConfig
    );

    if (!ctx.activePortalTransition) {
      applyTransitionState(computeTransitionState(
        currentStation.viewMode,
        nextStation.viewMode,
        currentStation.revealRadius,
        currentStation.revealSoftness,
        nextStation.revealRadius,
        nextStation.revealSoftness,
        ctx.portalTransitionProgress.value,
        transitionConfig
      ));
    }

    ctx.previousScrollProgress = clampedProgress;
    updateActiveStationUi(t, currentStation, nextStation, index, nextIndex);
    return;
  }

  cancelPortalTransition();

  if (index !== ctx.lastIntervalIndex) {
    ctx.transitionProgress.value = index > ctx.lastIntervalIndex ? 0.0 : 1.0;
    ctx.lastTargetP = ctx.transitionProgress.value;
    ctx.lastIntervalIndex = index;
    if (ctx.scrollTransitionTween) {
      ctx.scrollTransitionTween.kill();
      ctx.scrollTransitionTween = null;
    }
  }

  if (scrollDrivenPortalTransition) {
    if (ctx.scrollTransitionTween) {
      ctx.scrollTransitionTween.kill();
      ctx.scrollTransitionTween = null;
    }
    const portalProgress = nextStation.viewMode === 'portal'
      ? THREE.MathUtils.smoothstep(tRaw, transitionConfig.reconFadeStart, transitionConfig.reconFadeEnd)
      : t;
    ctx.transitionProgress.value = portalProgress;
    ctx.portalTransitionProgress.value = 0;
    ctx.lastTargetP = portalProgress;
  } else {
    let targetP = tRaw < 0.5 ? 0.0 : 1.0;
    let transitionDuration = 1.0;

    if (targetP !== ctx.lastTargetP) {
      ctx.lastTargetP = targetP;
      if (ctx.scrollTransitionTween) {
        ctx.scrollTransitionTween.kill();
      }

      ctx.scrollTransitionTween = gsap.to(ctx.transitionProgress, {
        value: targetP,
        duration: transitionDuration,
        ease: 'power2.out',
        onUpdate: () => {
          applyTransitionState(computeTransitionState(
            currentStation.viewMode,
            nextStation.viewMode,
            currentStation.revealRadius,
            currentStation.revealSoftness,
            nextStation.revealRadius,
            nextStation.revealSoftness,
            ctx.transitionProgress.value,
            transitionConfig
          ));
        }
      });
    }
  }

  if (ctx.activePortalTransition) {
    ctx.previousScrollProgress = clampedProgress;
    updateActiveStationUi(t, currentStation, nextStation, index, nextIndex);
    return;
  }

  const state = computeTransitionState(
    currentStation.viewMode,
    nextStation.viewMode,
    currentStation.revealRadius,
    currentStation.revealSoftness,
    nextStation.revealRadius,
    nextStation.revealSoftness,
    ctx.transitionProgress.value,
    transitionConfig
  );

  applyTransitionState(state);
  ctx.previousScrollProgress = clampedProgress;
  updateActiveStationUi(t, currentStation, nextStation, index, nextIndex);
}

function updateActiveStationUi(t, currentStation, nextStation, index, nextIndex) {
  let activeStation = t < 0.5 ? currentStation : nextStation;
  let activeStationIndex = t < 0.5 ? index : nextIndex;

  if (nextStation.viewMode === 'portal' && currentStation.viewMode !== 'portal') {
    const portalComplete = ctx.transitionProgress.value >= 0.98;
    activeStation = portalComplete ? nextStation : currentStation;
    activeStationIndex = portalComplete ? nextIndex : index;
  } else if (currentStation.viewMode === 'portal' && nextStation.viewMode === 'reveal') {
    const revealStarted = t > 0.001;
    activeStation = revealStarted ? nextStation : currentStation;
    activeStationIndex = revealStarted ? nextIndex : index;
  }

  if (window.appState.viewMode !== activeStation.viewMode) {
    window.appState.update({ viewMode: activeStation.viewMode });
  }

  syncScrollControlsForStation(activeStation);

  if (window.appState.currentStationIndex !== activeStationIndex) {
    window.appState.update({ currentStationIndex: activeStationIndex });
    updateStationImages(activeStation.images);
    window.audioManager?.playTransition();
  }
}

// ─── EVENTS ──────────────────────────────────────────
let dragStart = { x: 0, y: 0 };
let dragTime = 0;
let lastPlacementClickTime = 0;

canvas.addEventListener('mousedown', (e) => {
  dragStart.x = e.clientX;
  dragStart.y = e.clientY;
  dragTime = Date.now();
});

function pickAnnotationPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  ctx.raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

  const pickTargets = [ctx.ruinModel, ctx.reconModel, ctx.localModel].filter((model) => model?.visible);
  const hits = pickTargets.length > 0 ? ctx.raycaster.intersectObjects(pickTargets, true) : [];
  const point = hits[0]?.point?.clone();

  if (point) {
    if (hits[0]?.face && hits[0]?.object) {
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(hits[0].object.matrixWorld);
      const normal = hits[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();
      point.addScaledVector(normal, 0.08);
    }
    return point;
  }

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundPoint = new THREE.Vector3();
  if (ctx.raycaster.ray.intersectPlane(groundPlane, groundPoint)) {
    groundPoint.y += 0.08;
    return groundPoint;
  }

  return ctx.controls.target.clone();
}

function handleAnnotationPlacementClick(event) {
  if (!ctx.pendingAnnotationPlacement) return false;

  const point = pickAnnotationPoint(event);
  const placement = {
    position: { x: point.x, y: point.y, z: point.z },
    cameraPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    cameraTarget: { x: ctx.controls.target.x, y: ctx.controls.target.y, z: ctx.controls.target.z }
  };
  const onPlace = ctx.pendingAnnotationPlacement;
  ctx.pendingAnnotationPlacement = null;
  document.body.classList.remove('annotation-placement-mode');
  onPlace(placement);
  return true;
}

canvas.addEventListener('mouseup', (e) => {
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Date.now() - dragTime;

  if (ctx.pendingAnnotationPlacement && dist <= 6 && elapsed <= 500) {
    if (handleAnnotationPlacementClick(e)) return;
  }

  if (window.appState.mode !== 'aligning') return;

  if (dist > 6 || elapsed > 300) {
    return;
  }
  handleAlignClick(e);
});

canvas.addEventListener('pointerup', (e) => {
  if (!ctx.pendingAnnotationPlacement) return;
  if (Date.now() - lastPlacementClickTime < 50) return;

  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Date.now() - dragTime;

  if (dist <= 6 && elapsed <= 500 && handleAnnotationPlacementClick(e)) {
    lastPlacementClickTime = Date.now();
  }
});

function handleMove(clientX, clientY) {
  ctx.hasMouseMoved = true;
  if (window.appState?.mode !== 'reveal') return;
  const vm = window.appState?.viewMode;
  if (vm !== 'reveal' && !ctx.activePortalTransition && !ctx.targetRevealActive) return;

  const rect = canvas.getBoundingClientRect();
  const mx = ((clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((clientY - rect.top) / rect.height) * 2 + 1;
  ctx.mouseTarget.set(mx, my);
  ctx.isMouseOutside = false;
}

window.addEventListener('pointermove', (e) => handleMove(e.clientX, e.clientY));

document.addEventListener('pointerleave', () => {
  ctx.isMouseOutside = true;
});
document.addEventListener('mouseleave', () => {
  ctx.isMouseOutside = true;
});

// ─── RESIZE ──────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.getDrawingBufferSize(ctx.revealUniforms.uViewportSize.value);
});

// ─── START ───────────────────────────────────────────
init();
animate();

// ─── HMR RELOAD FOR THREE.JS ─────────────────────────
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}
