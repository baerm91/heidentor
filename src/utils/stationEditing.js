import { DEFAULT_IMAGE_SLOT, DEFAULT_LIGHT_POSITIONS, NEW_STATION_TEMPLATE } from '../constants.js';

export const cloneStationData = (value) => JSON.parse(JSON.stringify(value));

export const createImageSlots = (count = 3) => (
  Array.from({ length: count }, () => ({ ...DEFAULT_IMAGE_SLOT }))
);

export function updateStationAt(stations, index, updater) {
  if (!stations[index]) return stations;
  const updated = [...stations];
  const stationUpdate = updater({ ...updated[index] });
  updated[index] = stationUpdate ?? updated[index];
  return updated;
}

export function updateStationAnnotations(stations, stationIndex, updater) {
  return updateStationAt(stations, stationIndex, (station) => ({
    ...station,
    annotations: updater(Array.isArray(station.annotations) ? station.annotations : [])
  }));
}

export function updateAnnotationById(stations, stationIndex, annotationId, updater) {
  return updateStationAnnotations(stations, stationIndex, (annotations) => (
    annotations.map((annotation) => (
      annotation.id === annotationId ? updater(annotation) : annotation
    ))
  ));
}

export function createAnnotation(annotations, station, capture) {
  return {
    id: `annotation_${Date.now()}`,
    title: `Annotation ${annotations.length + 1}`,
    text: '',
    images: [],
    position: capture?.position ?? { x: 0, y: 3.5, z: 0 },
    cameraPos: capture?.cameraPos ?? station.cameraPos,
    cameraTarget: capture?.cameraTarget ?? station.cameraTarget
  };
}

export function createStation(stationCount, appState, coords) {
  return {
    ...cloneStationData(NEW_STATION_TEMPLATE),
    id: `station_${Date.now()}`,
    title: `Neue Station ${stationCount + 1}`,
    viewMode: appState.viewMode || NEW_STATION_TEMPLATE.viewMode,
    cameraPos: coords.cameraPos,
    cameraTarget: coords.cameraTarget,
    revealRadius: appState.revealRadius || NEW_STATION_TEMPLATE.revealRadius,
    revealSoftness: appState.revealSoftness || NEW_STATION_TEMPLATE.revealSoftness,
    showAnnotations: true,
    annotations: []
  };
}

export function getDefaultLightPosition(lightName) {
  if (lightName === 'lightKeyPos') return DEFAULT_LIGHT_POSITIONS.key;
  if (lightName === 'lightFillPos') return DEFAULT_LIGHT_POSITIONS.fill;
  return DEFAULT_LIGHT_POSITIONS.spot;
}
