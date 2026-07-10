import { useState, useEffect } from 'react';
import { FIELD_TO_STATE_SETTER, LIGHT_POS_SETTERS, KNOWN_BG_IMAGES } from '../constants.js';
import { defaultStations } from '../stations.js';
import {
  cloneStationData,
  createAnnotation,
  createImageSlots,
  createStation,
  getDefaultLightPosition,
  updateAnnotationById,
  updateStationAnnotations,
  updateStationAt
} from '../utils/stationEditing.js';

export function useEditorActions(appState) {
  const [editingStations, setEditingStations] = useState([]);
  const [editingIndex, setEditingIndex] = useState(0);
  const [activeAccordionIndex, setActiveAccordionIndex] = useState(null);
  const [activeImageAccordion, setActiveImageAccordion] = useState(0);
  const [dragState, setDragState] = useState(null);
  const [localModelPickerError, setLocalModelPickerError] = useState('');
  const [placingAnnotationId, setPlacingAnnotationId] = useState(null);

  // Mouse move and up handlers for dragging the text box in the editor
  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e) => {
      const deltaXPercent = ((e.clientX - dragState.startX) / window.innerWidth) * 100;
      const deltaYPercent = ((e.clientY - dragState.startY) / window.innerHeight) * 100;
      const newX = Math.max(2, Math.min(85, Math.round(dragState.startValueX + deltaXPercent)));
      const newY = Math.max(2, Math.min(85, Math.round(dragState.startValueY + deltaYPercent)));
      setEditingStations((currentStations) => updateStationAt(currentStations, editingIndex, (station) => {
        if (dragState.type === 'video') {
          return { ...station, videoX: newX, videoY: newY };
        }
        return { ...station, textX: newX, textY: newY };
      }));
    };
    const handleMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, editingIndex]);

  useEffect(() => () => {
    window.appState?.cancelAnnotationPlacement?.();
  }, []);

  const enterEditorMode = () => {
    const currentStations = cloneStationData(appState.stations);
    setEditingStations(currentStations);
    setEditingIndex(appState.currentStationIndex);
    window.appState?.setStationMode?.('editor');
  };

  const saveAndExitEditor = () => {
    window.appState?.cancelAnnotationPlacement?.();
    setPlacingAnnotationId(null);
    try {
      window.appState?.saveStations?.(editingStations);
    } catch (error) {
      alert(error.message);
      return;
    }
    if (window.location.pathname === '/edits') return;
    window.appState?.setStationMode?.('scroll');
    document.body.style.overflow = 'auto';
  };

  const cancelEditor = () => {
    window.appState?.cancelAnnotationPlacement?.();
    setPlacingAnnotationId(null);
    if (window.location.pathname === '/edits') {
      window.location.href = '/';
      return;
    }
    window.appState?.setStationMode?.('scroll');
    document.body.style.overflow = 'auto';
  };

  const handleCaptureCamera = (index) => {
    const coords = window.appState?.captureCamera?.();
    if (coords) {
      setEditingStations((currentStations) => updateStationAt(currentStations, index, (station) => ({
        ...station,
        cameraPos: coords.cameraPos,
        cameraTarget: coords.cameraTarget
      })));
    }
  };

  const handleAddAnnotation = (stationIndex) => {
    const capture = window.appState?.captureAnnotationContext?.() || window.appState?.captureCamera?.();
    const station = editingStations[stationIndex];
    if (!station) return;
    const annotations = Array.isArray(station.annotations) ? [...station.annotations] : [];
    annotations.push(createAnnotation(annotations, station, capture));
    setEditingStations((currentStations) => updateStationAt(currentStations, stationIndex, (currentStation) => ({
      ...currentStation,
      annotations,
      showAnnotations: true
    })));
    setEditingIndex(stationIndex);
    window.appState?.flyToStation?.(station, stationIndex);
  };

  const handleDeleteAnnotation = (stationIndex, annotationId) => {
    setEditingStations((currentStations) => updateStationAnnotations(
      currentStations,
      stationIndex,
      (annotations) => annotations.filter((annotation) => annotation.id !== annotationId)
    ));
  };

  const handleUpdateAnnotation = (stationIndex, annotationId, field, value) => {
    setEditingStations((currentStations) => updateAnnotationById(
      currentStations,
      stationIndex,
      annotationId,
      (annotation) => ({ ...annotation, [field]: value })
    ));
  };

  const handleCaptureAnnotation = (stationIndex, annotationId) => {
    const capture = window.appState?.captureAnnotationContext?.();
    if (!capture) return;
    setEditingStations((currentStations) => updateAnnotationById(
      currentStations,
      stationIndex,
      annotationId,
      (annotation) => ({
        ...annotation,
        position: capture.position,
        cameraPos: capture.cameraPos,
        cameraTarget: capture.cameraTarget
      })
    ));
  };

  const handlePlaceAnnotationInScene = (stationIndex, annotationId) => {
    if (placingAnnotationId === annotationId) {
      window.appState?.cancelAnnotationPlacement?.();
      setPlacingAnnotationId(null);
      return;
    }

    const station = editingStations[stationIndex];
    if (station) {
      setEditingIndex(stationIndex);
      window.appState?.flyToStation?.(station, stationIndex);
    }

    setPlacingAnnotationId(annotationId);
    window.appState?.startAnnotationPlacement?.((placement) => {
      setEditingStations((currentStations) => updateStationAt(currentStations, stationIndex, (currentStation) => ({
          ...currentStation,
          showAnnotations: true,
          annotations: (currentStation.annotations || []).map((annotation) => (
            annotation.id === annotationId ? {
              ...annotation,
              position: placement.position,
              cameraPos: placement.cameraPos,
              cameraTarget: placement.cameraTarget
            } : annotation
          ))
      })));
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('heidentor:annotation-placed', { detail: { annotationId } }));
      }, 0);
      setPlacingAnnotationId(null);
    });
  };

  const handleDragAnnotation = (annotationId, placement) => {
    if (!placement?.position) return;
    setEditingStations((currentStations) => updateStationAt(currentStations, editingIndex, (station) => ({
        ...station,
        showAnnotations: true,
        annotations: (station.annotations || []).map((annotation) => (
          annotation.id === annotationId ? {
            ...annotation,
            position: placement.position
          } : annotation
        ))
    })));
  };

  const handleTestStation = (index, station) => {
    setEditingIndex(index);
    window.appState?.flyToStation?.(station, index);
  };

  const handleAddStation = () => {
    const coords = window.appState?.captureCamera?.() || {
      cameraPos: { x: 0, y: 10, z: 22 },
      cameraTarget: { x: 0, y: 3.5, z: 0 }
    };
    const newStation = createStation(editingStations.length, appState, coords);
    const updated = [...editingStations, newStation];
    setEditingStations(updated);
    setEditingIndex(updated.length - 1);
  };

  const handleDeleteStation = (index) => {
    if (editingStations.length <= 1) {
      alert('Es muss mindestens eine Station übrig bleiben!');
      return;
    }
    const updated = editingStations.filter((_, idx) => idx !== index);
    setEditingStations(updated);
    if (editingIndex >= updated.length) setEditingIndex(updated.length - 1);
  };

  const handleMoveStation = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === editingStations.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...editingStations];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    if (editingIndex === index) setEditingIndex(targetIdx);
    else if (editingIndex === targetIdx) setEditingIndex(index);
    setEditingStations(updated);
  };

  const handleUpdateStationText = (index, field, val) => {
    const updated = updateStationAt(editingStations, index, (station) => ({
      ...station,
      [field]: val
    }));
    setEditingStations(updated);
    if (editingIndex === index) {
      const setterName = FIELD_TO_STATE_SETTER[field];
      if (setterName) {
        const setter = window.appState?.[setterName];
        if (setter) {
          setter(field === 'revealRadius' || field === 'revealSoftness' || field === 'lightIntensity' || field === 'shadowDiffuse' 
            || field.startsWith('portal') // Handle newly added portal params
            ? parseFloat(val) : val);
        }
      }
    }
  };

  const handleUpdateStationLightPos = (stationIndex, lightName, axis, val) => {
    const defaultPos = getDefaultLightPosition(lightName);
    const updated = updateStationAt(editingStations, stationIndex, (station) => ({
      ...station,
      [lightName]: {
        ...(station[lightName] ?? defaultPos),
        [axis]: val
      }
    }));
    setEditingStations(updated);
    if (editingIndex === stationIndex) {
      const setterInfo = LIGHT_POS_SETTERS[lightName];
      if (setterInfo) {
        window.appState?.[setterInfo.setPos]?.(updated[stationIndex][lightName]);
      }
    }
  };

  const handleToggleLightFixedToCamera = (stationIndex, lightName, fixedFieldName, isFixed) => {
    const station = editingStations[stationIndex];
    if (!station) return;
    const defaultPos = getDefaultLightPosition(lightName);
    const currentPos = station[lightName] ?? { ...defaultPos };
    let newPos = currentPos;
    if (window.appState?.convertPositionBetweenSpaces) {
      newPos = window.appState.convertPositionBetweenSpaces(currentPos, isFixed);
    }
    const updated = updateStationAt(editingStations, stationIndex, (currentStation) => ({
      ...currentStation,
      [fixedFieldName]: isFixed,
      [lightName]: newPos
    }));
    setEditingStations(updated);
    if (editingIndex === stationIndex) {
      const setterInfo = LIGHT_POS_SETTERS[lightName];
      if (setterInfo) {
        window.appState?.[setterInfo.setFixed]?.(isFixed);
        window.appState?.[setterInfo.setPos]?.(newPos);
      }
    }
  };

  const handleLocalImageUpload = (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Warnung: Das ausgewählte Bild ist sehr groß (' + (file.size / (1024 * 1024)).toFixed(1) + ' MB). Bilder über 2 MB können das Limit des lokalen Speichers (LocalStorage) überschriten.');
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === 'string') handleUpdateStationText(index, 'bgImage', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const getBgSelectValue = (bgImage) => {
    if (!bgImage) return '';
    if (KNOWN_BG_IMAGES.includes(bgImage)) return bgImage;
    if (bgImage.startsWith('data:image/')) return 'upload';
    return 'custom';
  };

  const handleUpdateStationImage = (stationIndex, imgIndex, field, val) => {
    const updated = updateStationAt(editingStations, stationIndex, (station) => {
      const images = station.images ? [...station.images] : createImageSlots();
      images[imgIndex] = {
        ...(images[imgIndex] ?? createImageSlots(1)[0]),
        [field]: val
      };
      return { ...station, images };
    });
    setEditingStations(updated);
    if (editingIndex === stationIndex) {
      window.appState?.updateActiveStationImages?.(updated[stationIndex].images);
    }
  };

  const handleLocal3DImageUpload = (stationIndex, imgIndex, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert('Warnung: Das ausgewählte Bild ist sehr groß (' + (file.size / (1024 * 1024)).toFixed(1) + ' MB). Bilder über 1.5 MB können das Limit des lokalen Speichers (LocalStorage) überschreiten.');
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === 'string') handleUpdateStationImage(stationIndex, imgIndex, 'url', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleAnnotationImageUpload = (stationIndex, annotationId, e) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;

    Promise.all(files.map((file) => new Promise((resolve) => {
      if (file.size > 1.5 * 1024 * 1024) {
        alert('Warnung: Das ausgewÃ¤hlte Bild ist sehr groÃŸ (' + (file.size / (1024 * 1024)).toFixed(1) + ' MB). Bilder Ã¼ber 1.5 MB kÃ¶nnen das Limit des lokalen Speichers (LocalStorage) Ã¼berschreiten.');
      }
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result);
      reader.readAsDataURL(file);
    }))).then((images) => {
      handleUpdateAnnotation(
        stationIndex,
        annotationId,
        'images',
        images.filter((image) => typeof image === 'string')
      );
    });
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Möchten Sie wirklich die vordefinierten Standard-Stationen wiederherstellen? Ihre Änderungen gehen verloren.')) {
      setEditingStations(cloneStationData(defaultStations));
    }
  };

  const handleLocalModelFiles = async (files) => {
    if (!files?.length) return;
    setLocalModelPickerError('');
    try {
      await window.appState?.loadLocalModelFiles?.(files);
    } catch (error) {
      setLocalModelPickerError(error.message);
    }
  };

  const handleLocalModelFolder = async () => {
    if (!window.showDirectoryPicker) return false;
    setLocalModelPickerError('');
    try {
      const directory = await window.showDirectoryPicker({ mode: 'read' });
      const files = [];
      const collectFiles = async (handle, prefix = '') => {
        for await (const [name, entry] of handle.entries()) {
          const relativePath = prefix ? `${prefix}/${name}` : name;
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            Object.defineProperty(file, 'relativePath', { value: relativePath });
            files.push(file);
          } else {
            await collectFiles(entry, relativePath);
          }
        }
      };
      await collectFiles(directory);
      await handleLocalModelFiles(files);
      return true;
    } catch (error) {
      if (error.name !== 'AbortError') setLocalModelPickerError(error.message);
      return true;
    }
  };

  const handleRemoveLocalModel = () => {
    setLocalModelPickerError('');
    window.appState?.removeLocalModel?.();
  };
  return {
    editingStations, setEditingStations,
    editingIndex, setEditingIndex,
    activeAccordionIndex, setActiveAccordionIndex,
    activeImageAccordion, setActiveImageAccordion,
    placingAnnotationId,
    dragState, setDragState,
    enterEditorMode, saveAndExitEditor, cancelEditor,
    handleCaptureCamera, handleTestStation,
    handleAddStation, handleDeleteStation, handleMoveStation,
    handleUpdateStationText, handleUpdateStationLightPos,
    handleToggleLightFixedToCamera,
    handleLocalImageUpload, getBgSelectValue,
    handleUpdateStationImage, handleLocal3DImageUpload,
    handleAddAnnotation, handleDeleteAnnotation, handleUpdateAnnotation,
    handleCaptureAnnotation, handlePlaceAnnotationInScene, handleDragAnnotation, handleAnnotationImageUpload,
    handleRestoreDefaults,
    handleLocalModelFolder, handleLocalModelFiles, handleRemoveLocalModel,
    localModelPickerError
  };
}
