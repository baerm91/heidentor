import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

import { createSkyDome, createGrassPlane, createLighting } from './src/environment.js';
import { loadModels, setupRevealMaterials } from './src/models.js';
import { computeAlignmentMatrix, saveAlignment, loadAlignment, clearAlignment, matrixToAlignment, alignmentToMatrix } from './src/alignment.js';
import { loadDraftStations, loadStationConfig, saveDraftStations } from './src/stations.js';


// ─── STATE BRIDGE FOR REACT ──────────────────────────
window.appState = {
  mode: 'loading',       // 'loading', 'aligning', 'reveal'
  alignStep: 0,          // 0 to 6 clicked points
  alignTarget: 'ruin',   // 'ruin', 'recon', 'done'
  viewMode: 'reveal',    // 'ruin', 'recon', 'reveal'
  revealRadius: 0.26,
  revealSoftness: 0.05,
  lensZoom: 1.0,

  // Scrolling landing page parameters
  stationMode: 'scroll',       // 'scroll', 'editor'
  stations: [],
  alignment: null,
  currentStationIndex: 0,
  scrollProgress: 0,
  hasUserManipulatedCamera: false,

  // Event handlers populated by Three.js
  realign: null,
  resetAlignment: null,
  skipAlignment: null,
  setViewMode: null,
  setRevealRadius: null,
  setRevealSoftness: null,
  setLensZoom: null,

  setStationMode: null,
  updateScrollProgress: null,
  saveStations: null,
  getAlignment: null,
  saveAlignmentConfig: null,

  // Callback set by React component to trigger re-renders
  onStateChange: null,

  // State update helper
  update(fields) {
    Object.assign(this, fields);
    if (this.onStateChange) this.onStateChange({ ...this });
  }
};

// ─── DOM & CANVAS ─────────────────────────────────────
const canvas = document.getElementById('scene-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingPercent = document.getElementById('loading-percent');

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
// Omit scene.background to allow transparency to CSS background
scene.fog = new THREE.FogExp2(0x010101, 0.019);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 22);

// ─── CONTROLS ─────────────────────────────────────────
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
// controls.maxPolarAngle = Math.PI / 2.05; // Allow camera to rotate below pedestal/ground
controls.minDistance = 0.5;                // Allow flying close
controls.maxDistance = 75;                 // Allow zooming out
controls.target.set(0, 3.5, 0);

let autoRotateTimer = null;

function pauseAutoRotate() {
  controls.autoRotate = false;
  clearTimeout(autoRotateTimer);
  autoRotateTimer = setTimeout(() => {
    if (window.appState.mode === 'reveal') {
      controls.autoRotate = true;
    }
  }, 5000);
}

canvas.addEventListener('pointerdown', () => {
  pauseAutoRotate();
  if (window.appState.scrollProgress >= 0.98 && !window.appState.hasUserManipulatedCamera) {
    window.appState.update({ hasUserManipulatedCamera: true });
  }
});

canvas.addEventListener('wheel', () => {
  pauseAutoRotate();
  if (window.appState.scrollProgress >= 0.98 && !window.appState.hasUserManipulatedCamera) {
    window.appState.update({ hasUserManipulatedCamera: true });
  }
});

// ─── ENVIRONMENT & LIGHTING ──────────────────────────
const skyMaterial = createSkyDome(scene);
const grassObj = createGrassPlane(scene);
createLighting(scene);

// ─── REVEAL UNIFORMS ─────────────────────────────────
const revealUniforms = {
  uMouseNDC: { value: new THREE.Vector2(9999, 9999) },
  uCameraWorldPos: { value: new THREE.Vector3(0, 0, 0) },
  uRayDirection: { value: new THREE.Vector3(0, 0, 1) },
  uRevealCenterWorld: { value: new THREE.Vector3(9999, 9999, 9999) },
  uRevealHasHit: { value: false },
  uWorldRadius: { value: 0.0 },
  uWorldSoftness: { value: 0.0 },
  uViewportSize: { value: new THREE.Vector2() },
  uRevealRadius: { value: 0.26 },
  uRevealSoftness: { value: 0.05 },
  uRevealActive: { value: false },
  uShowAlways: { value: false },
  uLensZoom: { value: 1.0 },
  uTime: { value: 0 },
  uOpacityRuin: { value: 1.0 },
  uOpacityRecon: { value: 0.0 }
};
renderer.getDrawingBufferSize(revealUniforms.uViewportSize.value);

const raycaster = new THREE.Raycaster();
const mouseTarget = new THREE.Vector2(9999, 9999);
let isRevealMode = false;
let isMouseOutside = true;

// ─── SCROLL INTERPOLATION STATE ───────────────────────
const targetCameraPos = new THREE.Vector3(0, 10, 22);
const targetCameraTarget = new THREE.Vector3(0, 3.5, 0);
let targetRevealRadius = 0.26;
let targetRevealSoftness = 0.05;
let targetOpacityRuin = 1.0;
let targetOpacityRecon = 0.0;
let targetRevealActive = false;
let targetShowAlways = false;

// Scroll section auto-transition variables
let lastIntervalIndex = 0;
let lastTargetP = 0.0;
const transitionProgress = { value: 0.0 };
let scrollTransitionTween = null;

// ─── ALIGNMENT STATE ──────────────────────────────────
let ruinModel = null;
let reconModel = null;
let ruinOffsetY = 0;
let reconOffsetY = 0;
let isModelAligned = false;
let revealHitMeshes = [];

const alignPoints = {
  ruin: [],      // Local Vector3s
  recon: [],     // Local Vector3s
  ruinWorld: [], // World Vector3s for markers
  reconWorld: [] // World Vector3s for markers
};
const alignMarkers = [];
const alignLines = [];

// ─── LOADING & INITIALIZATION ─────────────────────────
async function init() {
  try {
    const result = await loadModels(scene, (progress) => {
      const pct = Math.round(progress * 100);
      loadingBar.style.width = pct + '%';
      loadingPercent.textContent = pct + '%';
    });

    ruinModel = result.ruinModel;
    reconModel = result.reconModel;

    // Log scales, positions, and sizes
    const ruinBox = new THREE.Box3().setFromObject(ruinModel);
    const ruinSize = ruinBox.getSize(new THREE.Vector3());
    const reconBox = new THREE.Box3().setFromObject(reconModel);
    const reconSize = reconBox.getSize(new THREE.Vector3());
    console.log("Ruin wrapper scale:", ruinModel.scale.x.toFixed(4), "pos:", ruinModel.position.x.toFixed(2), ruinModel.position.y.toFixed(2), ruinModel.position.z.toFixed(2), "size:", ruinSize.x.toFixed(2), ruinSize.y.toFixed(2), ruinSize.z.toFixed(2));
    console.log("Recon wrapper scale:", reconModel.scale.x.toFixed(4), "pos:", reconModel.position.x.toFixed(2), reconModel.position.y.toFixed(2), reconModel.position.z.toFixed(2), "size:", reconSize.x.toFixed(2), reconSize.y.toFixed(2), reconSize.z.toFixed(2));

    // Capture artist-defined normalized height offsets
    ruinOffsetY = ruinModel.position.y;
    reconOffsetY = reconModel.position.y;

    // Enable shadows on models
    ruinModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    reconModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

    window.debug = {
      ruinModel,
      reconModel,
      THREE,
      scene,
      revealUniforms
    };

    // Setup reveal materials & inject uniforms
    setupRevealMaterials(ruinModel, false, revealUniforms);
    setupRevealMaterials(reconModel, true, revealUniforms);
    revealHitMeshes = collectRevealHitMeshes(reconModel);
    console.log("revealHitMeshes count:", revealHitMeshes.length);
    revealHitMeshes.forEach((m, idx) => console.log(`Mesh ${idx}:`, m.name, "geometry:", m.geometry.type));

    // Bind shared state event handlers
    setupStateBridge();

    // Load stations from localStorage or the editable JSON file.
    const jsonConfig = await loadStationConfig();
    const initialStations = loadDraftStations() ?? jsonConfig.stations;

    window.appState.update({
      stations: initialStations,
      alignment: jsonConfig.alignment
    });

    // Check for saved alignment
    const savedMatrix = loadAlignment(jsonConfig.alignment);
    if (savedMatrix) {
      reconModel.applyMatrix4(savedMatrix);
      reconModel.updateMatrixWorld(true);
      isModelAligned = true;
      window.appState.update({ alignment: matrixToAlignment(savedMatrix) });
      finishLoading(false);
    } else {
      finishLoading(true);
    }
  } catch (err) {
    console.error('Failed to load models:', err);
    loadingPercent.textContent = 'Fehler beim Laden!';
  }
}

function finishLoading(showAlignment) {
  loadingBar.style.width = '100%';
  loadingPercent.textContent = '100%';

  gsap.to(loadingScreen, {
    opacity: 0,
    duration: 0.8,
    delay: 0.3,
    ease: 'power2.out',
    onComplete: () => {
      loadingScreen.style.display = 'none';
    }
  });

  gsap.delayedCall(0.5, () => {
    if (showAlignment) {
      startAlignmentMode();
    } else {
      enterRevealMode();
    }
  });
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

    // Skip broad, nearly flat base/floor meshes so the reveal locks onto the monument volume.
    if (relativeHeight < 0.04 || bottomOffset < 0.08) {
      return;
    }

    pickMeshes.push(child);
  });

  return pickMeshes;
}

function configureReconstructionDepth(useSceneDepth) {
  if (!reconModel) return;

  reconModel.renderOrder = useSceneDepth ? 0 : 10;
  reconModel.traverse((child) => {
    if (!child.isMesh) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      mat.depthTest = true;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    });
  });
}

// ─── STATE BRIDGE ACTIONS ────────────────────────────
function setupStateBridge() {
  window.appState.realign = () => {
    clearAlignment();
    location.reload();
  };

  window.appState.resetAlignment = () => {
    alignPoints.ruin = [];
    alignPoints.recon = [];
    alignPoints.ruinWorld = [];
    alignPoints.reconWorld = [];
    clearMarkers();
    clearLines();
    isModelAligned = false;

    // Position both models back to center and reset visibility
    ruinModel.position.set(0, ruinOffsetY, 0);
    reconModel.position.set(0, reconOffsetY, 0);
    ruinModel.visible = true;
    reconModel.visible = false;

    window.appState.update({
      alignStep: 0,
      alignTarget: 'ruin'
    });
  };

  window.appState.skipAlignment = () => {
    clearMarkers();
    clearLines();
    isModelAligned = false;
    ruinModel.position.set(0, ruinOffsetY, 0);
    reconModel.position.set(0, reconOffsetY, 0);
    enterRevealMode();
  };

  window.appState.setViewMode = (mode) => {
    window.appState.update({ viewMode: mode });
    let opRuin = 1.0;
    let opRecon = 0.0;
    let revActive = false;
    let shAlways = false;

    if (mode === 'ruin') {
      if (ruinModel) ruinModel.visible = true;
      if (reconModel) reconModel.visible = false;
      configureReconstructionDepth(true);
      opRuin = 1.0;
      opRecon = 0.0;
      revActive = false;
      shAlways = false;
      revealUniforms.uRevealHasHit.value = false;
    } else if (mode === 'recon') {
      if (ruinModel) ruinModel.visible = false;
      if (reconModel) reconModel.visible = true;
      configureReconstructionDepth(true);
      opRuin = 0.0;
      opRecon = 1.0;
      revActive = false;
      shAlways = true;
      revealUniforms.uRevealHasHit.value = false;
    } else {
      if (ruinModel) ruinModel.visible = true;
      if (reconModel) reconModel.visible = true;
      configureReconstructionDepth(false);
      opRuin = 1.0;
      opRecon = 1.0;
      revActive = true;
      shAlways = false;
    }

    targetOpacityRuin = opRuin;
    targetOpacityRecon = opRecon;
    targetRevealActive = revActive;
    targetShowAlways = shAlways;

    revealUniforms.uOpacityRuin.value = opRuin;
    revealUniforms.uOpacityRecon.value = opRecon;
    revealUniforms.uRevealActive.value = revActive;
    revealUniforms.uShowAlways.value = shAlways;
  };

  window.appState.setRevealRadius = (r) => {
    revealUniforms.uRevealRadius.value = r;
    targetRevealRadius = r;
    window.appState.update({ revealRadius: r });
  };

  window.appState.setRevealSoftness = (s) => {
    revealUniforms.uRevealSoftness.value = s;
    targetRevealSoftness = s;
    window.appState.update({ revealSoftness: s });
  };

  window.appState.setLensZoom = (z) => {
    revealUniforms.uLensZoom.value = z;
    window.appState.update({ lensZoom: z });
  };

  window.appState.setStationMode = (mode) => {
    window.appState.update({ stationMode: mode });
    if (mode === 'editor') {
      controls.enabled = true;
      controls.autoRotate = false;
    } else {
      // Re-trigger scroll camera positions (which sets controls.enabled correctly)
      updateScrollProgress(window.appState.scrollProgress);
    }
  };

  window.appState.updateScrollProgress = (progress) => {
    updateScrollProgress(progress);
  };

  window.appState.saveStations = (newStations) => {
    saveDraftStations(newStations);
    window.appState.update({ stations: newStations });
    updateScrollProgress(window.appState.scrollProgress);
  };

  window.appState.getAlignment = () => window.appState.alignment;

  window.appState.saveAlignmentConfig = (alignment) => {
    const matrix = alignmentToMatrix(alignment);
    if (!matrix) return;

    saveAlignment(matrix);
    window.appState.update({ alignment: matrixToAlignment(matrix) });
  };

  window.appState.captureCamera = () => {
    return {
      cameraPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      cameraTarget: { x: controls.target.x, y: controls.target.y, z: controls.target.z }
    };
  };

  window.appState.flyToStation = (station) => {
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    
    gsap.to(camera.position, {
      x: station.cameraPos.x,
      y: station.cameraPos.y,
      z: station.cameraPos.z,
      duration: 1.2,
      ease: 'power3.out'
    });
    
    gsap.to(controls.target, {
      x: station.cameraTarget.x,
      y: station.cameraTarget.y,
      z: station.cameraTarget.z,
      duration: 1.2,
      ease: 'power3.out',
      onUpdate: () => {
        controls.update();
      }
    });

    const currentStation = window.appState.stations[window.appState.currentStationIndex] || station;
    const transitionObj = { progress: 0 };
    
    gsap.killTweensOf(transitionObj);
    gsap.to(transitionObj, {
      progress: 1,
      duration: 1.2,
      ease: 'power3.out',
      onUpdate: () => {
        const state = computeTransitionState(
          currentStation.viewMode,
          station.viewMode,
          currentStation.revealRadius,
          currentStation.revealSoftness,
          station.revealRadius,
          station.revealSoftness,
          transitionObj.progress
        );
        targetOpacityRuin = state.opacityRuin;
        targetOpacityRecon = state.opacityRecon;
        targetRevealActive = state.revealActive;
        targetShowAlways = state.showAlways;
        targetRevealRadius = state.revealRadius;
        targetRevealSoftness = state.revealSoftness;
      },
      onComplete: () => {
        window.appState.update({ 
          viewMode: station.viewMode,
          currentStationIndex: window.appState.stations.indexOf(station)
        });
      }
    });
  };
}

function computeTransitionState(mode0, mode1, r0, s0, r1, s1, t) {
  let opacityRuin = 1.0;
  let opacityRecon = 0.0;
  let revealActive = false;
  let showAlways = false;
  let revealRadius = 0.0;
  let revealSoftness = 0.0;

  if (mode0 === 'ruin' && mode1 === 'ruin') {
    opacityRuin = 1.0;
    opacityRecon = 0.0;
    revealActive = false;
    showAlways = false;
    revealRadius = 0.0;
    revealSoftness = 0.0;
  } else if (mode0 === 'recon' && mode1 === 'recon') {
    opacityRuin = 0.0;
    opacityRecon = 1.0;
    revealActive = false;
    showAlways = true;
    revealRadius = 0.0;
    revealSoftness = 0.0;
  } else if (mode0 === 'reveal' && mode1 === 'reveal') {
    opacityRuin = 1.0;
    opacityRecon = 1.0;
    revealActive = true;
    showAlways = false;
    revealRadius = THREE.MathUtils.lerp(r0, r1, t);
    revealSoftness = THREE.MathUtils.lerp(s0, s1, t);
  } else if ((mode0 === 'ruin' && mode1 === 'recon') || (mode0 === 'recon' && mode1 === 'ruin')) {
    revealActive = false;
    showAlways = true;
    revealRadius = 0.0;
    revealSoftness = 0.0;
    if (mode0 === 'ruin') {
      opacityRuin = 1.0 - t;
      opacityRecon = t;
    } else {
      opacityRuin = t;
      opacityRecon = 1.0 - t;
    }
  } else if ((mode0 === 'ruin' && mode1 === 'reveal') || (mode0 === 'reveal' && mode1 === 'ruin')) {
    revealActive = true;
    showAlways = false;
    opacityRuin = 1.0;
    opacityRecon = 1.0;
    if (mode0 === 'ruin') {
      revealRadius = THREE.MathUtils.lerp(0.0, r1, t);
      revealSoftness = THREE.MathUtils.lerp(0.0, s1, t);
    } else {
      revealRadius = THREE.MathUtils.lerp(r0, 0.0, t);
      revealSoftness = THREE.MathUtils.lerp(s0, 0.0, t);
    }
  } else if ((mode0 === 'recon' && mode1 === 'reveal') || (mode0 === 'reveal' && mode1 === 'recon')) {
    revealActive = true;
    showAlways = false;
    opacityRecon = 1.0;
    if (mode0 === 'recon') {
      opacityRuin = t;
      revealRadius = THREE.MathUtils.lerp(3.0, r1, t);
      revealSoftness = THREE.MathUtils.lerp(0.1, s1, t);
    } else {
      opacityRuin = 1.0 - t;
      revealRadius = THREE.MathUtils.lerp(r0, 3.0, t);
      revealSoftness = THREE.MathUtils.lerp(s0, 0.1, t);
    }
  }

  return {
    opacityRuin,
    opacityRecon,
    revealActive,
    showAlways,
    revealRadius,
    revealSoftness
  };
}

// ─── SCROLL UPDATE HANDLER ────────────────────────────
function updateScrollProgress(progress) {
  const clampedProgress = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  window.appState.update({ scrollProgress: clampedProgress });

  const stations = window.appState.stations || [];
  const N = stations.length;
  if (N === 0) return;
  if (N === 1) {
    const onlyStation = stations[0];
    targetCameraPos.set(onlyStation.cameraPos.x, onlyStation.cameraPos.y, onlyStation.cameraPos.z);
    targetCameraTarget.set(onlyStation.cameraTarget.x, onlyStation.cameraTarget.y, onlyStation.cameraTarget.z);
    targetRevealRadius = onlyStation.revealRadius;
    targetRevealSoftness = onlyStation.revealSoftness;

    if (window.appState.viewMode !== onlyStation.viewMode) {
      window.appState.setViewMode(onlyStation.viewMode);
    }
    if (window.appState.currentStationIndex !== 0) {
      window.appState.update({ currentStationIndex: 0 });
    }
    return;
  }

  const lastStationThreshold = 0.98;

  if (clampedProgress >= lastStationThreshold) {
    if (!controls.enabled && window.appState.stationMode === 'scroll') {
      controls.enabled = true;
      controls.autoRotate = false;
      // Snap target to final station's camera target once to prevent jumping when first enabled
      const lastStation = stations[N - 1];
      controls.target.set(lastStation.cameraTarget.x, lastStation.cameraTarget.y, lastStation.cameraTarget.z);
    }
  } else {
    if (window.appState.hasUserManipulatedCamera) {
      window.appState.update({ hasUserManipulatedCamera: false });
    }
    if (controls.enabled && window.appState.stationMode === 'scroll') {
      controls.enabled = false;
      controls.autoRotate = false;
    }
  }

  const normProgress = clampedProgress;
  const totalIntervals = N - 1;
  const scaledProgress = normProgress * totalIntervals;
  const index = Math.min(Math.floor(scaledProgress), N - 1);
  const nextIndex = Math.min(index + 1, N - 1);
  const tRaw = scaledProgress - index;

  // Smooth the transition using smoothstep
  const t = THREE.MathUtils.smoothstep(tRaw, 0, 1);

  const currentStation = stations[index];
  const nextStation = stations[nextIndex];

  // Set target camera position and target
  targetCameraPos.set(
    THREE.MathUtils.lerp(currentStation.cameraPos.x, nextStation.cameraPos.x, t),
    THREE.MathUtils.lerp(currentStation.cameraPos.y, nextStation.cameraPos.y, t),
    THREE.MathUtils.lerp(currentStation.cameraPos.z, nextStation.cameraPos.z, t)
  );

  targetCameraTarget.set(
    THREE.MathUtils.lerp(currentStation.cameraTarget.x, nextStation.cameraTarget.x, t),
    THREE.MathUtils.lerp(currentStation.cameraTarget.y, nextStation.cameraTarget.y, t),
    THREE.MathUtils.lerp(currentStation.cameraTarget.z, nextStation.cameraTarget.z, t)
  );

  // Detect interval changes and reset progress accordingly
  if (index !== lastIntervalIndex) {
    if (index > lastIntervalIndex) {
      transitionProgress.value = 0.0;
      lastTargetP = 0.0;
    } else {
      transitionProgress.value = 1.0;
      lastTargetP = 1.0;
    }
    lastIntervalIndex = index;
    if (scrollTransitionTween) {
      scrollTransitionTween.kill();
      scrollTransitionTween = null;
    }
  }

  // Determine target progress in current interval
  const targetP = (tRaw < 0.5) ? 0.0 : 1.0;

  if (targetP !== lastTargetP) {
    lastTargetP = targetP;
    if (scrollTransitionTween) {
      scrollTransitionTween.kill();
    }

    scrollTransitionTween = gsap.to(transitionProgress, {
      value: targetP,
      duration: 1.0,
      ease: 'power2.out',
      onUpdate: () => {
        const state = computeTransitionState(
          currentStation.viewMode,
          nextStation.viewMode,
          currentStation.revealRadius,
          currentStation.revealSoftness,
          nextStation.revealRadius,
          nextStation.revealSoftness,
          transitionProgress.value
        );
        targetOpacityRuin = state.opacityRuin;
        targetOpacityRecon = state.opacityRecon;
        targetRevealActive = state.revealActive;
        targetShowAlways = state.showAlways;
        targetRevealRadius = state.revealRadius;
        targetRevealSoftness = state.revealSoftness;
      }
    });
  }

  // Compute transition properties using the animated transitionProgress
  const state = computeTransitionState(
    currentStation.viewMode,
    nextStation.viewMode,
    currentStation.revealRadius,
    currentStation.revealSoftness,
    nextStation.revealRadius,
    nextStation.revealSoftness,
    transitionProgress.value
  );

  targetOpacityRuin = state.opacityRuin;
  targetOpacityRecon = state.opacityRecon;
  targetRevealActive = state.revealActive;
  targetShowAlways = state.showAlways;
  targetRevealRadius = state.revealRadius;
  targetRevealSoftness = state.revealSoftness;

  // View mode transition at midpoint (updates UI)
  const activeStation = t < 0.5 ? currentStation : nextStation;
  if (window.appState.viewMode !== activeStation.viewMode) {
    window.appState.update({ viewMode: activeStation.viewMode });
  }

  const activeStationIndex = t < 0.5 ? index : nextIndex;
  if (window.appState.currentStationIndex !== activeStationIndex) {
    window.appState.update({ currentStationIndex: activeStationIndex });
  }
}

// ─── ALIGNMENT MODE ──────────────────────────────────
function startAlignmentMode() {
  window.appState.update({
    mode: 'aligning',
    alignStep: 0,
    alignTarget: 'ruin'
  });

  isRevealMode = false;
  controls.autoRotate = false;

  // Position both models at center (0, y, 0) for perfect OrbitControls target focus
  ruinModel.position.set(0, ruinOffsetY, 0);
  reconModel.position.set(0, reconOffsetY, 0);

  // Show ruin, hide reconstruction first
  ruinModel.visible = true;
  reconModel.visible = false;

  revealUniforms.uRevealActive.value = false;
  revealUniforms.uShowAlways.value = true;

  // Focus camera directly on the center model
  controls.target.set(0, 3.5, 0);
  camera.position.set(10, 7.5, 14);

  // Clear any existing markers/lines/points
  window.appState.resetAlignment();
}

function handleAlignClick(event) {
  if (window.appState.mode !== 'aligning') return;

  const rect = canvas.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

  const isRuinTurn = window.appState.alignTarget === 'ruin';
  const targetModel = isRuinTurn ? ruinModel : reconModel;
  const intersects = raycaster.intersectObject(targetModel, true);

  if (intersects.length === 0) return;

  const worldPoint = intersects[0].point.clone();
  const localPoint = targetModel.worldToLocal(worldPoint.clone());

  if (isRuinTurn) {
    alignPoints.ruin.push(localPoint);
    alignPoints.ruinWorld.push(worldPoint);
    addMarker(worldPoint, 'ruin');

    const nextStep = window.appState.alignStep + 1;
    if (nextStep === 3) {
      // Transition to Reconstruction phase
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'recon'
      });
      // Hide ruin and its markers, show reconstruction
      ruinModel.visible = false;
      alignMarkers.forEach(m => { if (m.userData.type === 'ruin') m.visible = false; });
      reconModel.visible = true;
    } else {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'ruin'
      });
    }
  } else {
    alignPoints.recon.push(localPoint);
    alignPoints.reconWorld.push(worldPoint);
    addMarker(worldPoint, 'recon');

    const nextStep = window.appState.alignStep + 1;
    if (nextStep === 6) {
      window.appState.update({
        alignStep: nextStep,
        alignTarget: 'done'
      });
      // Delay slightly for visual feedback, then align and merge!
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
  const color = type === 'ruin' ? 0xffa726 : 0x6ef0f5; // Gold vs Teal
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
  alignMarkers.push(sphere);
}

function addConnectingLine(p1, p2) {
  // Line helper not needed for sequential mode, but kept as mock
}

function clearMarkers() {
  alignMarkers.forEach(m => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  alignMarkers.length = 0;
}

function clearLines() {
  alignLines.forEach(l => {
    scene.remove(l);
    l.geometry.dispose();
    l.material.dispose();
  });
  alignLines.length = 0;
}

function completeAlignment() {
  const matrix = computeAlignmentMatrix(alignPoints.reconWorld, alignPoints.ruinWorld);

  if (matrix) {
    reconModel.applyMatrix4(matrix);
    reconModel.updateMatrixWorld(true);
    saveAlignment(matrix);
    window.appState.update({ alignment: matrixToAlignment(matrix) });
    isModelAligned = true;
  }

  // Clear visual markers
  clearMarkers();

  // Reset visibilities for reveal mode
  ruinModel.visible = true;
  reconModel.visible = true;

  // Make materials transparent for reveal compile
  reconModel.traverse((child) => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { m.opacity = 1.0; m.transparent = true; m.needsUpdate = true; });
    }
  });

  // Smooth cinematic camera target and scan sweep animation
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);

  // Assemble Sweep: Golden shockwave scan line radiating outward
  revealUniforms.uRevealActive.value = true;
  revealUniforms.uCameraWorldPos.value.copy(camera.position);
  const modelCenter = new THREE.Vector3(0, ruinOffsetY, 0);
  revealUniforms.uRayDirection.value.subVectors(modelCenter, camera.position).normalize();
  revealUniforms.uRevealCenterWorld.value.copy(modelCenter);
  revealUniforms.uRevealHasHit.value = true;
  revealUniforms.uMouseNDC.value.set(0, 0); // start at center
  revealUniforms.uRevealRadius.value = 0.0;
  revealUniforms.uRevealSoftness.value = 0.15; // wide glow soft edge

  const tl = gsap.timeline({
    onComplete: () => {
      enterRevealMode();
    }
  });

  tl.to(revealUniforms.uRevealRadius, {
    value: 1.8,
    duration: 2.5,
    ease: 'power2.inOut'
  });

  tl.to(revealUniforms.uRevealRadius, {
    value: 0.26,
    duration: 1.2,
    ease: 'power2.out'
  });

  tl.to(revealUniforms.uRevealSoftness, {
    value: 0.05,
    duration: 0.8
  }, '-=1.2');

  // Rotate camera slightly to frame the merged monument beautifully
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
  isRevealMode = true;

  // Move models to center, preserving their height offsets
  ruinModel.position.set(0, ruinOffsetY, 0);
  if (!isModelAligned) {
    reconModel.position.set(0, reconOffsetY, 0);
  }

  revealUniforms.uRevealActive.value = true;
  revealUniforms.uShowAlways.value = false;
  revealUniforms.uRevealHasHit.value = false;
  revealUniforms.uRevealCenterWorld.value.set(9999, 9999, 9999);

  reconModel.traverse((child) => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { m.opacity = 1.0; m.transparent = true; m.needsUpdate = true; });
    }
  });

  ruinModel.visible = true;
  reconModel.visible = true;
  configureReconstructionDepth(false);

  // Initialize camera to first station if available
  if (window.appState.stations && window.appState.stations.length > 0) {
    const first = window.appState.stations[0];
    camera.position.set(first.cameraPos.x, first.cameraPos.y, first.cameraPos.z);
    controls.target.set(first.cameraTarget.x, first.cameraTarget.y, first.cameraTarget.z);
    targetCameraPos.copy(camera.position);
    targetCameraTarget.copy(controls.target);
    
    revealUniforms.uRevealRadius.value = first.revealRadius;
    revealUniforms.uRevealSoftness.value = first.revealSoftness;
    targetRevealRadius = first.revealRadius;
    targetRevealSoftness = first.revealSoftness;

    lastIntervalIndex = 0;
    lastTargetP = 0.0;
    transitionProgress.value = 0.0;
    if (scrollTransitionTween) {
      scrollTransitionTween.kill();
      scrollTransitionTween = null;
    }

    window.appState.update({
      mode: 'reveal',
      stationMode: 'scroll',
      viewMode: first.viewMode,
      scrollProgress: 0,
      currentStationIndex: 0
    });
    window.appState.setViewMode(first.viewMode);
  } else {
    window.appState.update({
      mode: 'reveal',
      stationMode: 'scroll',
      viewMode: 'reveal',
      scrollProgress: 0,
      currentStationIndex: 0
    });
  }

  controls.enabled = false;
  controls.autoRotate = false;
}

// ─── EVENTS ──────────────────────────────────────────
let dragStart = { x: 0, y: 0 };
let dragTime = 0;

canvas.addEventListener('mousedown', (e) => {
  dragStart.x = e.clientX;
  dragStart.y = e.clientY;
  dragTime = Date.now();
});

canvas.addEventListener('mouseup', (e) => {
  if (window.appState.mode !== 'aligning') return;

  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Date.now() - dragTime;

  // Prevent placing a marker if the user was actually dragging/orbiting the camera
  if (dist > 6 || elapsed > 300) {
    return;
  }

  handleAlignClick(e);
});

function handleMove(clientX, clientY) {
  if (window.appState.mode !== 'reveal' || window.appState.viewMode !== 'reveal') return;

  const rect = canvas.getBoundingClientRect();
  const mx = ((clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((clientY - rect.top) / rect.height) * 2 + 1;
  mouseTarget.set(mx, my);
  isMouseOutside = false;
}

window.addEventListener('pointermove', (e) => handleMove(e.clientX, e.clientY));
window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));

document.addEventListener('pointerleave', () => {
  isMouseOutside = true;
});
document.addEventListener('mouseleave', () => {
  isMouseOutside = true;
});

// ─── RESIZE ──────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.getDrawingBufferSize(revealUniforms.uViewportSize.value);
});

// ─── ANIMATION LOOP ──────────────────────────────────
const clock = new THREE.Clock();
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);
  frameCount++;

  const elapsed = clock.getElapsedTime();



  // Update time for environment/material animations (e.g. scanlines)
  revealUniforms.uTime.value = elapsed;
  if (skyMaterial && skyMaterial.uniforms && skyMaterial.uniforms.uTime) {
    skyMaterial.uniforms.uTime.value = elapsed;
  }
  if (grassObj && grassObj.material && grassObj.material.uniforms && grassObj.material.uniforms.uTime) {
    grassObj.material.uniforms.uTime.value = elapsed;
  }

  // Smooth cursor follow and camera ray calculation
  if (isRevealMode && window.appState.viewMode === 'reveal') {
    if (isMouseOutside) {
      mouseTarget.set(9999, 9999);
      revealUniforms.uMouseNDC.value.lerp(mouseTarget, 0.08);
    } else {
      if (revealUniforms.uMouseNDC.value.x > 9000) {
        revealUniforms.uMouseNDC.value.copy(mouseTarget);
      } else {
        revealUniforms.uMouseNDC.value.lerp(mouseTarget, 0.15);
      }
    }

    // Always update camera position and ray direction based on current uMouseNDC
    revealUniforms.uCameraWorldPos.value.copy(camera.position);
    raycaster.setFromCamera(revealUniforms.uMouseNDC.value, camera);
    revealUniforms.uRayDirection.value.copy(raycaster.ray.direction);

    const revealHits = isMouseOutside ? [] : raycaster.intersectObjects(revealHitMeshes, false);
    if (revealHits.length > 0) {
      const hit = revealHits[0].point;
      revealUniforms.uRevealCenterWorld.value.copy(hit);
      revealUniforms.uRevealHasHit.value = true;
    } else {
      revealUniforms.uRevealCenterWorld.value.set(9999, 9999, 9999);
      revealUniforms.uRevealHasHit.value = false;
    }
  }

  if (window.appState.mode === 'reveal') {
    if (window.appState.stationMode === 'scroll') {
      if (window.appState.scrollProgress < 0.98 || !window.appState.hasUserManipulatedCamera) {
        camera.position.lerp(targetCameraPos, 0.06);
        controls.target.lerp(targetCameraTarget, 0.06);
      }
      
      revealUniforms.uRevealRadius.value = THREE.MathUtils.lerp(revealUniforms.uRevealRadius.value, targetRevealRadius, 0.06);
      revealUniforms.uRevealSoftness.value = THREE.MathUtils.lerp(revealUniforms.uRevealSoftness.value, targetRevealSoftness, 0.06);
    }
    
    // Smoothly lerp opacities towards target values in reveal mode
    revealUniforms.uOpacityRuin.value = THREE.MathUtils.lerp(revealUniforms.uOpacityRuin.value, targetOpacityRuin, 0.08);
    revealUniforms.uOpacityRecon.value = THREE.MathUtils.lerp(revealUniforms.uOpacityRecon.value, targetOpacityRecon, 0.08);
    revealUniforms.uRevealActive.value = targetRevealActive;
    revealUniforms.uShowAlways.value = targetShowAlways;
    
    // Manage model visibility to save draw calls
    if (ruinModel) ruinModel.visible = (revealUniforms.uOpacityRuin.value > 0.01);
    if (reconModel) {
      reconModel.visible = (revealUniforms.uOpacityRecon.value > 0.01 || (targetRevealActive && revealUniforms.uRevealRadius.value > 0.01));
      reconModel.renderOrder = targetRevealActive ? 10 : 0;
    }
  }

  // Calculate world radius and softness dynamically from camera distance to keep screen-space size constant
  const distToTarget = camera.position.distanceTo(controls.target);
  const fovRad = (camera.fov * Math.PI) / 180;
  const halfFovHeight = distToTarget * Math.tan(fovRad / 2);
  revealUniforms.uWorldRadius.value = revealUniforms.uRevealRadius.value * halfFovHeight;
  revealUniforms.uWorldSoftness.value = revealUniforms.uRevealSoftness.value * halfFovHeight;

  controls.update();
  renderer.render(scene, camera);
}

// ─── START ───────────────────────────────────────────
init();
animate();

// ─── HMR RELOAD FOR THREE.JS ─────────────────────────
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}
