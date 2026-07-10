import bundledStations from '../heidentor-stations.json';

const STATIONS_DRAFT_KEY = 'heidentor_custom_stations';

const DEFAULT_ALIGNMENT_MATRIX = [
  -0.16408309158164905,
  0,
  0.7482956953574085,
  0,
  0,
  0.7660742187499977,
  0,
  0,
  -0.7482956953574085,
  0,
  -0.16408309158164905,
  0,
  -2.5640625,
  0.6219292827544601,
  -1.8394531249999966,
  1
];

export const normalizeAlignment = (alignment) => {
  const matrix = Array.isArray(alignment)
    ? alignment
    : alignment?.reconstructionMatrix;

  if (!Array.isArray(matrix) || matrix.length !== 16 || matrix.some((value) => typeof value !== 'number')) {
    return null;
  }

  return {
    reconstructionMatrix: matrix
  };
};

export const normalizeStations = (stations) => {
  if (!Array.isArray(stations)) return [];

  return stations.map((station, index) => ({
    id: station.id ?? `station_${index}`,
    title: station.title ?? `Station ${index + 1}`,
    description: station.description ?? "",
    viewMode: station.viewMode ?? "reveal",
    cameraPos: station.cameraPos ?? { x: 0, y: 10, z: 22 },
    cameraTarget: station.cameraTarget ?? { x: 0, y: 3.5, z: 0 },
    revealRadius: typeof station.revealRadius === 'number' ? station.revealRadius : 0.26,
    revealSoftness: typeof station.revealSoftness === 'number' ? station.revealSoftness : 0.05,
    portalRadius: typeof station.portalRadius === 'number' ? station.portalRadius : 3.2,
    portalSoftness: typeof station.portalSoftness === 'number' ? station.portalSoftness : 0.2,
    portalTransitionDuration: typeof station.portalTransitionDuration === 'number' ? station.portalTransitionDuration : 2.8,
    portalMouseStart: typeof station.portalMouseStart === 'number' ? station.portalMouseStart : 0.2,
    portalRuinFadeEnd: typeof station.portalRuinFadeEnd === 'number' ? station.portalRuinFadeEnd : 0.22,
    portalRevealRuinFadeStart: typeof station.portalRevealRuinFadeStart === 'number' ? station.portalRevealRuinFadeStart : 0.18,
    portalRevealRuinFadeEnd: typeof station.portalRevealRuinFadeEnd === 'number' ? station.portalRevealRuinFadeEnd : 0.85,
    portalReconFadeStart: typeof station.portalReconFadeStart === 'number' ? station.portalReconFadeStart : 0.08,
    portalReconFadeEnd: typeof station.portalReconFadeEnd === 'number' ? station.portalReconFadeEnd : 0.46,
    bgImage: station.bgImage ?? "",
    textX: typeof station.textX === 'number' ? station.textX : 10,
    textY: typeof station.textY === 'number' ? station.textY : 35,
    subTitle: station.subTitle ?? "",
    subDescription: station.subDescription ?? "",
    videoUrl: station.videoUrl ?? "",
    videoX: typeof station.videoX === 'number' ? station.videoX : 58,
    videoY: typeof station.videoY === 'number' ? station.videoY : 22,
    videoWidth: typeof station.videoWidth === 'number' ? station.videoWidth : 28,
    videoHeight: typeof station.videoHeight === 'number' ? station.videoHeight : 18,
    textLayer: station.textLayer ?? "front",
    milkyBg: !!station.milkyBg,
    freeNavigation: typeof station.freeNavigation === 'boolean' ? station.freeNavigation : index === stations.length - 1,
    showAnnotations: typeof station.showAnnotations === 'boolean' ? station.showAnnotations : true,
    annotations: Array.isArray(station.annotations) ? station.annotations.map((annotation, annotationIndex) => ({
      id: annotation.id ?? `annotation_${index}_${annotationIndex}`,
      title: annotation.title ?? `Annotation ${annotationIndex + 1}`,
      text: annotation.text ?? "",
      position: annotation.position ? {
        x: typeof annotation.position.x === 'number' ? annotation.position.x : 0,
        y: typeof annotation.position.y === 'number' ? annotation.position.y : 3.5,
        z: typeof annotation.position.z === 'number' ? annotation.position.z : 0
      } : { x: 0, y: 3.5, z: 0 },
      cameraPos: annotation.cameraPos ? {
        x: typeof annotation.cameraPos.x === 'number' ? annotation.cameraPos.x : (station.cameraPos?.x ?? 0),
        y: typeof annotation.cameraPos.y === 'number' ? annotation.cameraPos.y : (station.cameraPos?.y ?? 10),
        z: typeof annotation.cameraPos.z === 'number' ? annotation.cameraPos.z : (station.cameraPos?.z ?? 22)
      } : (station.cameraPos ?? { x: 0, y: 10, z: 22 }),
      cameraTarget: annotation.cameraTarget ? {
        x: typeof annotation.cameraTarget.x === 'number' ? annotation.cameraTarget.x : (station.cameraTarget?.x ?? 0),
        y: typeof annotation.cameraTarget.y === 'number' ? annotation.cameraTarget.y : (station.cameraTarget?.y ?? 3.5),
        z: typeof annotation.cameraTarget.z === 'number' ? annotation.cameraTarget.z : (station.cameraTarget?.z ?? 0)
      } : (station.cameraTarget ?? { x: 0, y: 3.5, z: 0 }),
      images: Array.isArray(annotation.images)
        ? annotation.images.slice(0, 4).filter(Boolean)
        : []
    })) : [],
    lightIntensity: typeof station.lightIntensity === 'number' ? station.lightIntensity : 1.0,
    shadowDiffuse: typeof station.shadowDiffuse === 'number' ? station.shadowDiffuse : 1.0,
    lightHemiEnabled: typeof station.lightHemiEnabled === 'boolean' ? station.lightHemiEnabled : true,
    lightKeyEnabled: typeof station.lightKeyEnabled === 'boolean' ? station.lightKeyEnabled : true,
    lightKeyFixedToCamera: !!station.lightKeyFixedToCamera,
    lightKeyPos: station.lightKeyPos ? {
      x: typeof station.lightKeyPos.x === 'number' ? station.lightKeyPos.x : 8,
      y: typeof station.lightKeyPos.y === 'number' ? station.lightKeyPos.y : 16,
      z: typeof station.lightKeyPos.z === 'number' ? station.lightKeyPos.z : 10
    } : { x: 8, y: 16, z: 10 },
    lightFillEnabled: typeof station.lightFillEnabled === 'boolean' ? station.lightFillEnabled : true,
    lightFillFixedToCamera: !!station.lightFillFixedToCamera,
    lightFillPos: station.lightFillPos ? {
      x: typeof station.lightFillPos.x === 'number' ? station.lightFillPos.x : -8,
      y: typeof station.lightFillPos.y === 'number' ? station.lightFillPos.y : 12,
      z: typeof station.lightFillPos.z === 'number' ? station.lightFillPos.z : -10
    } : { x: -8, y: 12, z: -10 },
    lightSpotEnabled: typeof station.lightSpotEnabled === 'boolean' ? station.lightSpotEnabled : true,
    lightSpotFixedToCamera: !!station.lightSpotFixedToCamera,
    lightSpotPos: station.lightSpotPos ? {
      x: typeof station.lightSpotPos.x === 'number' ? station.lightSpotPos.x : 0,
      y: typeof station.lightSpotPos.y === 'number' ? station.lightSpotPos.y : 15,
      z: typeof station.lightSpotPos.z === 'number' ? station.lightSpotPos.z : 0
    } : { x: 0, y: 15, z: 0 },
    images: Array.isArray(station.images) ? station.images.slice(0, 3).concat(
      Array(Math.max(0, 3 - station.images.length)).fill(null)
    ).map((img, idx) => {
      const fallback = img || {};
      return {
        url: fallback.url ?? "",
        posX: typeof fallback.posX === 'number' ? fallback.posX : 0,
        posY: typeof fallback.posY === 'number' ? fallback.posY : 3.5,
        posZ: typeof fallback.posZ === 'number' ? fallback.posZ : 0,
        scale: typeof fallback.scale === 'number' ? fallback.scale : 1.0,
        fixToCamera: !!fallback.fixToCamera
      };
    }) : [
      { url: "", posX: 0, posY: 3.5, posZ: 0, scale: 1.0, fixToCamera: false },
      { url: "", posX: 0, posY: 3.5, posZ: 0, scale: 1.0, fixToCamera: false },
      { url: "", posX: 0, posY: 3.5, posZ: 0, scale: 1.0, fixToCamera: false }
    ]
  }));
};

export const normalizeStationConfig = (config) => {
  const stations = Array.isArray(config) ? config : config?.stations;
  const fallbackAlignment = normalizeAlignment({
    reconstructionMatrix: DEFAULT_ALIGNMENT_MATRIX
  });

  return {
    alignment: normalizeAlignment(config?.alignment) ?? fallbackAlignment,
    stations: normalizeStations(stations)
  };
};

export const defaultStationConfig = normalizeStationConfig(bundledStations);
export const defaultStations = defaultStationConfig.stations;

export async function loadStationConfig() {
  try {
    const response = await fetch('/heidentor-stations.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const config = normalizeStationConfig(await response.json());
    if (config.stations.length === 0) throw new Error('No stations found.');

    return config;
  } catch (error) {
    console.warn('Could not load heidentor-stations.json; using bundled station data.', error);
    return defaultStationConfig;
  }
}

export const serializeStationConfig = (stations, alignment) => ({
  alignment: normalizeAlignment(alignment),
  stations: normalizeStations(stations)
});

export const formatStationConfig = (stations, alignment) =>
  JSON.stringify(serializeStationConfig(stations, alignment), null, 2);

export const loadDraftStations = () => {
  const data = localStorage.getItem(STATIONS_DRAFT_KEY);
  if (!data) return null;

  try {
    const stations = normalizeStations(JSON.parse(data));
    return stations.length > 0 ? stations : null;
  } catch (error) {
    console.warn('Saved station draft is invalid; removing it.', error);
    localStorage.removeItem(STATIONS_DRAFT_KEY);
    return null;
  }
};

export const saveDraftStations = (stations) => {
  try {
    localStorage.setItem(STATIONS_DRAFT_KEY, JSON.stringify(normalizeStations(stations)));
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      throw new Error('Die Konfiguration ist für den lokalen Browser-Speicher zu groß. Entfernen oder verkleinern Sie hochgeladene Bilder und versuchen Sie es erneut.');
    }
    throw new Error(`Die Konfiguration konnte nicht lokal gespeichert werden: ${error.message}`);
  }
};
