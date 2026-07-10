import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { normalizeModel } from '../models.js';
import { ctx } from './context.js';

const MODEL_EXTENSIONS = ['.gltf', '.glb'];

function safeDecodePath(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

const normalizePath = (path) => {
  const segments = safeDecodePath(path)
    .replace(/\\/g, '/')
    .split('/');
  const normalized = [];

  segments.forEach((segment) => {
    if (!segment || segment === '.') return;
    if (segment === '..') {
      normalized.pop();
      return;
    }
    normalized.push(segment);
  });

  return normalized.join('/');
};

const getRelativePath = (file) => normalizePath(
  file.relativePath || file.webkitRelativePath || file.name
);

function findModelFile(files) {
  const candidates = files.filter((file) => {
    const name = file.name.toLowerCase();
    return MODEL_EXTENSIONS.some((extension) => name.endsWith(extension));
  });

  if (candidates.length === 0) {
    throw new Error('Im Ordner wurde keine .gltf- oder .glb-Datei gefunden.');
  }

  return candidates.sort((a, b) => {
    const aScene = a.name.toLowerCase() === 'scene.gltf' ? 0 : 1;
    const bScene = b.name.toLowerCase() === 'scene.gltf' ? 0 : 1;
    return aScene - bScene || getRelativePath(a).split('/').length - getRelativePath(b).split('/').length;
  })[0];
}

function disposeMaterial(material) {
  Object.values(material).forEach((value) => {
    if (value?.isTexture) value.dispose();
  });
  material.dispose();
}

function disposeModel(model) {
  const geometries = new Set();
  const materials = new Set();

  model.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry) geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach(disposeMaterial);
}

export function removeLocalModel() {
  ctx.localModelLoadId += 1;

  if (ctx.localModel) {
    ctx.scene.remove(ctx.localModel);
    disposeModel(ctx.localModel);
    ctx.localModel = null;
  }

  ctx.localModelObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  ctx.localModelObjectUrls = [];

  window.appState?.update({
    localModelName: '',
    localModelStatus: 'idle',
    localModelError: ''
  });
}

export async function loadLocalModelFiles(fileList) {
  const loadId = ++ctx.localModelLoadId;
  const files = Array.from(fileList || []);
  if (files.length === 0) throw new Error('Der ausgewaehlte Ordner ist leer.');

  const modelFile = findModelFile(files);
  const modelPath = getRelativePath(modelFile);
  const modelDirectory = modelPath.includes('/')
    ? modelPath.slice(0, modelPath.lastIndexOf('/') + 1)
    : '';

  const objectUrls = [];
  const filesByPath = new Map();
  const filesByName = new Map();

  files.forEach((file) => {
    const relativePath = getRelativePath(file);
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    filesByPath.set(relativePath.toLowerCase(), url);
    const lowerName = file.name.toLowerCase();
    filesByName.set(lowerName, filesByName.has(lowerName) ? null : url);
  });

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((requestedUrl) => {
    if (/^(blob:|data:|https?:)/i.test(requestedUrl)) return requestedUrl;

    const requestedPath = normalizePath(requestedUrl);
    const relativeToModel = normalizePath(`${modelDirectory}${requestedPath}`);
    return filesByPath.get(relativeToModel.toLowerCase())
      || filesByPath.get(requestedPath.toLowerCase())
      || filesByName.get(requestedPath.split('/').pop().toLowerCase())
      || requestedUrl;
  });

  const loader = new GLTFLoader(manager);
  const dracoLoader = new DRACOLoader(manager)
    .setDecoderPath('/three-codecs/draco/');
  const ktx2Loader = ctx.renderer
    ? new KTX2Loader(manager)
      .setTranscoderPath('/three-codecs/basis/')
      .detectSupport(ctx.renderer)
    : null;

  loader.setDRACOLoader(dracoLoader);
  if (ktx2Loader) loader.setKTX2Loader(ktx2Loader);
  loader.setMeshoptDecoder(MeshoptDecoder);

  let parsedScene = null;

  try {
    const data = modelFile.name.toLowerCase().endsWith('.glb')
      ? await modelFile.arrayBuffer()
      : await modelFile.text();

    const gltf = await new Promise((resolve, reject) => {
      loader.parse(data, '', resolve, reject);
    });
    parsedScene = gltf.scene;

    if (loadId !== ctx.localModelLoadId) {
      disposeModel(gltf.scene);
      parsedScene = null;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      return null;
    }

    const wrapper = normalizeModel(gltf.scene);
    wrapper.name = `Lokales Modell: ${modelFile.name}`;
    wrapper.visible = window.appState?.stationMode === 'editor';
    wrapper.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    if (ctx.localModel) {
      ctx.scene.remove(ctx.localModel);
      disposeModel(ctx.localModel);
    }
    ctx.localModelObjectUrls.forEach((url) => URL.revokeObjectURL(url));

    ctx.scene.add(wrapper);
    ctx.localModel = wrapper;
    ctx.localModelObjectUrls = objectUrls;
    parsedScene = null;

    window.appState?.update({
      localModelName: modelFile.name,
      localModelStatus: 'loaded',
      localModelError: ''
    });

    return wrapper;
  } catch (error) {
    if (parsedScene) disposeModel(parsedScene);
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    if (loadId !== ctx.localModelLoadId) return null;
    throw new Error(`Das Modell konnte nicht geladen werden: ${error.message}`);
  } finally {
    dracoLoader.dispose();
    ktx2Loader?.dispose();
  }
}
