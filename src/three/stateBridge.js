import * as THREE from 'three';
import gsap from 'gsap';
import { ctx } from './context.js';
import { saveAlignment, matrixToAlignment, alignmentToMatrix, clearAlignment } from '../alignment.js';
import { saveDraftStations } from '../stations.js';
import { configureReconstructionDepth } from './portalTransition.js';

// Synchronously initialize window.appState to avoid race conditions with animation loop
window.appState = {
  mode: 'loading',
  alignStep: 0,
  alignTarget: 'ruin',
  viewMode: 'reveal',
  revealRadius: 0.26,
  revealSoftness: 0.05,
  lensZoom: 1.0,
  lightIntensity: 1.0,
  shadowDiffuse: 1.0,
  stationMode: 'scroll',
  stations: [],
  alignment: null,
  currentStationIndex: 0,
  scrollProgress: 0,
  hasUserManipulatedCamera: false,
  introPhase: 'idle',
  hasIntroPlayed: false,

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
  setLightIntensity: null,
  setShadowDiffuse: null,
  updateActiveStationImages: null,
  setLightHemiEnabled: null,
  setLightKeyEnabled: null,
  setLightFillEnabled: null,
  setLightSpotEnabled: null,
  setLightKeyPos: null,
  setLightFillPos: null,
  setLightSpotPos: null,
  setLightKeyFixedToCamera: null,
  setLightFillFixedToCamera: null,
  setLightSpotFixedToCamera: null,
  convertPositionBetweenSpaces: null,
  onStateChange: null,

  update(fields) {
    Object.assign(this, fields);
    if (this.onStateChange) this.onStateChange({ ...this });
  }
};

export function setupStateBridge() {
  window.appState.realign = () => {
    // We clear alignment and reload
    clearAlignment();
    location.reload();
  };

  window.appState.resetAlignment = () => {
    ctx.alignPoints.ruin = [];
    ctx.alignPoints.recon = [];
    ctx.alignPoints.ruinWorld = [];
    ctx.alignPoints.reconWorld = [];
    ctx.actions.clearMarkers();
    ctx.actions.clearLines();
    ctx.isModelAligned = false;

    // Position both models back to center and reset visibility
    ctx.ruinModel.position.set(0, ctx.ruinOffsetY, 0);
    ctx.reconModel.position.set(0, ctx.reconOffsetY, 0);
    ctx.ruinModel.visible = true;
    ctx.reconModel.visible = false;

    window.appState.update({
      alignStep: 0,
      alignTarget: 'ruin'
    });
  };

  window.appState.skipAlignment = () => {
    ctx.actions.clearMarkers();
    ctx.actions.clearLines();
    ctx.isModelAligned = false;
    ctx.ruinModel.position.set(0, ctx.ruinOffsetY, 0);
    ctx.reconModel.position.set(0, ctx.reconOffsetY, 0);
    ctx.actions.enterRevealMode();
  };

  window.appState.setViewMode = (mode) => {
    window.appState.update({ viewMode: mode });
    let opRuin = 1.0;
    let opRecon = 0.0;
    let portalTint = 0.0;
    let revActive = false;
    let shAlways = false;
    let followsMouse = false;
    let mouseBlend = 0;

    if (mode === 'ruin') {
      if (ctx.ruinModel) ctx.ruinModel.visible = true;
      if (ctx.reconModel) ctx.reconModel.visible = false;
      configureReconstructionDepth(true);
      opRuin = 1.0;
      opRecon = 0.0;
      revActive = false;
      shAlways = false;
      ctx.revealUniforms.uRevealHasHit.value = false;
    } else if (mode === 'recon') {
      if (ctx.ruinModel) ctx.ruinModel.visible = false;
      if (ctx.reconModel) ctx.reconModel.visible = true;
      configureReconstructionDepth(true);
      opRuin = 0.0;
      opRecon = 1.0;
      portalTint = 0.0;
      revActive = false;
      shAlways = true;
      ctx.revealUniforms.uRevealHasHit.value = false;
    } else if (mode === 'portal') {
      if (ctx.ruinModel) ctx.ruinModel.visible = true;
      if (ctx.reconModel) ctx.reconModel.visible = true;
      configureReconstructionDepth(false);
      opRuin = 0.0;
      opRecon = 1.0;
      portalTint = 1.0;
      revActive = false;
      shAlways = true;
      followsMouse = false;
      ctx.revealUniforms.uMouseNDC.value.set(0, 0);
      ctx.revealUniforms.uRevealHasHit.value = false;
    } else {
      if (ctx.ruinModel) ctx.ruinModel.visible = true;
      if (ctx.reconModel) ctx.reconModel.visible = true;
      configureReconstructionDepth(false);
      opRuin = 1.0;
      opRecon = 1.0;
      portalTint = 1.0;
      revActive = true;
      shAlways = false;
      followsMouse = true;
      mouseBlend = 1;
    }

    ctx.targetOpacityRuin = opRuin;
    ctx.targetOpacityRecon = opRecon;
    ctx.targetPortalTint = portalTint;
    ctx.targetRevealActive = revActive;
    ctx.targetShowAlways = shAlways;
    ctx.targetRevealFollowsMouse = followsMouse;
    ctx.targetRevealMouseBlend = mouseBlend;

    ctx.revealUniforms.uOpacityRuin.value = opRuin;
    ctx.revealUniforms.uOpacityRecon.value = opRecon;
    ctx.revealUniforms.uPortalTint.value = portalTint;
    ctx.revealUniforms.uRevealActive.value = revActive;
    ctx.revealUniforms.uShowAlways.value = shAlways;
  };

  window.appState.setRevealRadius = (r) => {
    ctx.revealUniforms.uRevealRadius.value = r;
    ctx.targetRevealRadius = r;
    window.appState.update({ revealRadius: r });
  };

  window.appState.setRevealSoftness = (s) => {
    ctx.revealUniforms.uRevealSoftness.value = s;
    ctx.targetRevealSoftness = s;
    window.appState.update({ revealSoftness: s });
  };

  window.appState.setLensZoom = (z) => {
    ctx.revealUniforms.uLensZoom.value = z;
    window.appState.update({ lensZoom: z });
  };

  window.appState.setLightIntensity = (val) => {
    ctx.targetLightIntensity = val;
    window.appState.update({ lightIntensity: val });
  };

  window.appState.setShadowDiffuse = (val) => {
    ctx.targetShadowDiffuse = val;
    window.appState.update({ shadowDiffuse: val });
  };

  window.appState.updateActiveStationImages = (images) => {
    ctx.actions.updateStationImages(images);
  };

  window.appState.setLightHemiEnabled = (val) => {
    ctx.targetHemiEnabled = val ? 1.0 : 0.0;
    ctx.currentHemiEnabled = ctx.targetHemiEnabled;
  };

  window.appState.setLightKeyEnabled = (val) => {
    ctx.targetKeyEnabled = val ? 1.0 : 0.0;
    ctx.currentKeyEnabled = ctx.targetKeyEnabled;
  };

  window.appState.setLightFillEnabled = (val) => {
    ctx.targetFillEnabled = val ? 1.0 : 0.0;
    ctx.currentFillEnabled = ctx.targetFillEnabled;
  };

  window.appState.setLightSpotEnabled = (val) => {
    ctx.targetSpotEnabled = val ? 1.0 : 0.0;
    ctx.currentSpotEnabled = ctx.targetSpotEnabled;
  };

  window.appState.setLightKeyPos = (pos) => {
    ctx.targetKeyPos.set(pos?.x ?? 8, pos?.y ?? 16, pos?.z ?? 10);
    ctx.currentKeyPos.copy(ctx.targetKeyPos);
  };

  window.appState.setLightFillPos = (pos) => {
    ctx.targetFillPos.set(pos?.x ?? -8, pos?.y ?? 12, pos?.z ?? -10);
    ctx.currentFillPos.copy(ctx.targetFillPos);
  };

  window.appState.setLightSpotPos = (pos) => {
    ctx.targetSpotPos.set(pos?.x ?? 0, pos?.y ?? 15, pos?.z ?? 0);
    ctx.currentSpotPos.copy(ctx.targetSpotPos);
  };

  window.appState.setLightKeyFixedToCamera = (val) => {
    ctx.targetKeyFixedToCamera = !!val;
    ctx.currentKeyFixedToCamera = ctx.targetKeyFixedToCamera;
  };

  window.appState.setLightFillFixedToCamera = (val) => {
    ctx.targetFillFixedToCamera = !!val;
    ctx.currentFillFixedToCamera = ctx.targetFillFixedToCamera;
  };

  window.appState.setLightSpotFixedToCamera = (val) => {
    ctx.targetSpotFixedToCamera = !!val;
    ctx.currentSpotFixedToCamera = ctx.targetSpotFixedToCamera;
  };

  window.appState.convertPositionBetweenSpaces = (pos, toCameraSpace) => {
    const vec = new THREE.Vector3(pos.x, pos.y, pos.z);
    if (toCameraSpace) {
      ctx.camera.updateMatrixWorld();
      const viewMatrix = new THREE.Matrix4().copy(ctx.camera.matrixWorld).invert();
      vec.applyMatrix4(viewMatrix);
    } else {
      ctx.camera.updateMatrixWorld();
      vec.applyMatrix4(ctx.camera.matrixWorld);
    }
    return { x: vec.x, y: vec.y, z: vec.z };
  };

  window.appState.setStationMode = (mode) => {
    window.appState.update({ stationMode: mode });
    if (mode === 'editor') {
      ctx.controls.enabled = true;
      ctx.controls.autoRotate = false;
    } else {
      ctx.actions.updateScrollProgress(window.appState.scrollProgress);
    }
  };

  window.appState.updateScrollProgress = (progress) => {
    ctx.actions.updateScrollProgress(progress);
  };

  window.appState.saveStations = (newStations) => {
    saveDraftStations(newStations);
    window.appState.update({ stations: newStations });
    ctx.actions.updateScrollProgress(window.appState.scrollProgress);
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
      cameraPos: { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z },
      cameraTarget: { x: ctx.controls.target.x, y: ctx.controls.target.y, z: ctx.controls.target.z }
    };
  };

  window.appState.flyToStation = (station) => {
    gsap.killTweensOf(ctx.camera.position);
    gsap.killTweensOf(ctx.controls.target);
    const currentStation = window.appState.stations[window.appState.currentStationIndex] || station;
    const transitionConfig = ctx.actions.getPortalTransitionConfig(currentStation, station);
    const isPortalRevealFlyTo = ctx.actions.isPortalRevealTransition(currentStation.viewMode, station.viewMode);
    const flyDuration = isPortalRevealFlyTo ? transitionConfig.duration : 1.2;
    const flyEase = isPortalRevealFlyTo ? 'none' : 'power3.out';

    ctx.targetLightIntensity = station.lightIntensity ?? 1.0;
    ctx.targetShadowDiffuse = station.shadowDiffuse ?? 1.0;
    ctx.targetHemiEnabled = (station.lightHemiEnabled ?? true) ? 1.0 : 0.0;
    ctx.targetKeyEnabled = (station.lightKeyEnabled ?? true) ? 1.0 : 0.0;
    ctx.targetFillEnabled = (station.lightFillEnabled ?? true) ? 1.0 : 0.0;
    ctx.targetSpotEnabled = (station.lightSpotEnabled ?? true) ? 1.0 : 0.0;
    ctx.targetKeyFixedToCamera = !!station.lightKeyFixedToCamera;
    ctx.targetFillFixedToCamera = !!station.lightFillFixedToCamera;
    ctx.targetSpotFixedToCamera = !!station.lightSpotFixedToCamera;

    ctx.targetKeyPos.set(station.lightKeyPos?.x ?? 8, station.lightKeyPos?.y ?? 16, station.lightKeyPos?.z ?? 10);
    ctx.targetFillPos.set(station.lightFillPos?.x ?? -8, station.lightFillPos?.y ?? 12, station.lightFillPos?.z ?? -10);
    ctx.targetSpotPos.set(station.lightSpotPos?.x ?? 0, station.lightSpotPos?.y ?? 15, station.lightSpotPos?.z ?? 0);

    ctx.actions.updateStationImages(station.images);
    
    gsap.to(ctx.camera.position, {
      x: station.cameraPos.x,
      y: station.cameraPos.y,
      z: station.cameraPos.z,
      duration: flyDuration,
      ease: flyEase
    });
    
    gsap.to(ctx.controls.target, {
      x: station.cameraTarget.x,
      y: station.cameraTarget.y,
      z: station.cameraTarget.z,
      duration: flyDuration,
      ease: flyEase,
      onUpdate: () => {
        ctx.controls.update();
      }
    });

    const transitionObj = { progress: 0 };
    if (isPortalRevealFlyTo) {
      ctx.actions.applyTransitionState(ctx.actions.computeTransitionState(
        currentStation.viewMode,
        station.viewMode,
        currentStation.revealRadius,
        currentStation.revealSoftness,
        station.revealRadius,
        station.revealSoftness,
        0,
        transitionConfig
      ));
    }
    
    gsap.killTweensOf(transitionObj);
    gsap.to(transitionObj, {
      progress: 1,
      duration: flyDuration,
      ease: flyEase,
      onUpdate: () => {
        const state = ctx.actions.computeTransitionState(
          currentStation.viewMode,
          station.viewMode,
          currentStation.revealRadius,
          currentStation.revealSoftness,
          station.revealRadius,
          station.revealSoftness,
          transitionObj.progress,
          transitionConfig
        );
        ctx.actions.applyTransitionState(state);
      },
      onComplete: () => {
        window.appState.update({ 
          viewMode: station.viewMode,
          currentStationIndex: window.appState.stations.indexOf(station),
          lightIntensity: ctx.targetLightIntensity,
          shadowDiffuse: ctx.targetShadowDiffuse
        });
      }
    });
  };
}
