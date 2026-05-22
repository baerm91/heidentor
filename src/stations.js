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
    milkyBg: !!station.milkyBg
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
  localStorage.setItem(STATIONS_DRAFT_KEY, JSON.stringify(normalizeStations(stations)));
};
