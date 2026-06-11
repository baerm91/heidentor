import { useState, useEffect } from 'react';
import { DEFAULT_LIGHT_POSITIONS, FIELD_TO_STATE_SETTER, LIGHT_POS_SETTERS, KNOWN_BG_IMAGES } from '../constants.js';
import { defaultStations } from '../stations.js';

export function useEditorActions(appState) {
  const [editingStations, setEditingStations] = useState([]);
  const [editingIndex, setEditingIndex] = useState(0);
  const [activeAccordionIndex, setActiveAccordionIndex] = useState(null);
  const [activeImageAccordion, setActiveImageAccordion] = useState(0);
  const [dragState, setDragState] = useState(null);

  // Mouse move and up handlers for dragging the text box in the editor
  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e) => {
      const deltaXPercent = ((e.clientX - dragState.startX) / window.innerWidth) * 100;
      const deltaYPercent = ((e.clientY - dragState.startY) / window.innerHeight) * 100;
      const newX = Math.max(2, Math.min(85, Math.round(dragState.startValueX + deltaXPercent)));
      const newY = Math.max(2, Math.min(85, Math.round(dragState.startValueY + deltaYPercent)));
      const updated = [...editingStations];
      if (updated[editingIndex]) {
        if (dragState.type === 'video') {
          updated[editingIndex].videoX = newX;
          updated[editingIndex].videoY = newY;
        } else {
          updated[editingIndex].textX = newX;
          updated[editingIndex].textY = newY;
        }
        setEditingStations(updated);
      }
    };
    const handleMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, editingStations, editingIndex]);

  const enterEditorMode = () => {
    const currentStations = JSON.parse(JSON.stringify(appState.stations));
    setEditingStations(currentStations);
    setEditingIndex(appState.currentStationIndex);
    window.appState?.setStationMode?.('editor');
  };

  const saveAndExitEditor = () => {
    window.appState?.saveStations?.(editingStations);
    if (window.location.pathname === '/edits') return;
    window.appState?.setStationMode?.('scroll');
    document.body.style.overflow = 'auto';
  };

  const cancelEditor = () => {
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
      const updated = [...editingStations];
      updated[index].cameraPos = coords.cameraPos;
      updated[index].cameraTarget = coords.cameraTarget;
      setEditingStations(updated);
    }
  };

  const handleTestStation = (index, station) => {
    setEditingIndex(index);
    window.appState?.flyToStation?.(station);
  };

  const handleAddStation = () => {
    const coords = window.appState?.captureCamera?.() || {
      cameraPos: { x: 0, y: 10, z: 22 },
      cameraTarget: { x: 0, y: 3.5, z: 0 }
    };
    const newStation = {
      id: `station_${Date.now()}`,
      title: `Neue Station ${editingStations.length + 1}`,
      description: 'Beschreiben Sie hier, was an dieser Station zu sehen ist.',
      viewMode: appState.viewMode || 'reveal',
      cameraPos: coords.cameraPos,
      cameraTarget: coords.cameraTarget,
      revealRadius: appState.revealRadius || 0.26,
      revealSoftness: appState.revealSoftness || 0.05,
      bgImage: '',
      textX: 10, textY: 35,
      subTitle: '', subDescription: '',
      videoUrl: '', videoX: 58, videoY: 22, videoWidth: 28, videoHeight: 18,
      textLayer: 'front', milkyBg: false
    };
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
    const updated = [...editingStations];
    updated[index][field] = val;
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
    const updated = [...editingStations];
    const defaultPos = lightName === 'lightKeyPos' ? DEFAULT_LIGHT_POSITIONS.key
                     : lightName === 'lightFillPos' ? DEFAULT_LIGHT_POSITIONS.fill
                     : DEFAULT_LIGHT_POSITIONS.spot;
    if (!updated[stationIndex][lightName]) {
      updated[stationIndex][lightName] = { ...defaultPos };
    }
    updated[stationIndex][lightName][axis] = val;
    setEditingStations(updated);
    if (editingIndex === stationIndex) {
      const setterInfo = LIGHT_POS_SETTERS[lightName];
      if (setterInfo) {
        window.appState?.[setterInfo.setPos]?.(updated[stationIndex][lightName]);
      }
    }
  };

  const handleToggleLightFixedToCamera = (stationIndex, lightName, fixedFieldName, isFixed) => {
    const updated = [...editingStations];
    const station = updated[stationIndex];
    const defaultPos = lightName === 'lightKeyPos' ? DEFAULT_LIGHT_POSITIONS.key
                     : lightName === 'lightFillPos' ? DEFAULT_LIGHT_POSITIONS.fill
                     : DEFAULT_LIGHT_POSITIONS.spot;
    const currentPos = station[lightName] ?? { ...defaultPos };
    let newPos = currentPos;
    if (window.appState?.convertPositionBetweenSpaces) {
      newPos = window.appState.convertPositionBetweenSpaces(currentPos, isFixed);
    }
    station[fixedFieldName] = isFixed;
    station[lightName] = newPos;
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
    const updated = [...editingStations];
    if (!updated[stationIndex].images) {
      updated[stationIndex].images = [
        { url: '', posX: 0, posY: 3.5, posZ: 0, scale: 1.0, fixToCamera: false },
        { url: '', posX: 0, posY: 3.5, posZ: 0, scale: 1.0, fixToCamera: false },
        { url: '', posX: 0, posY: 3.5, posZ: 0, scale: 1.0, fixToCamera: false }
      ];
    }
    updated[stationIndex].images[imgIndex][field] = val;
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

  const handleRestoreDefaults = () => {
    if (window.confirm('Möchten Sie wirklich die vordefinierten Standard-Stationen wiederherstellen? Ihre Änderungen gehen verloren.')) {
      setEditingStations(JSON.parse(JSON.stringify(defaultStations)));
    }
  };

  return {
    editingStations, setEditingStations,
    editingIndex, setEditingIndex,
    activeAccordionIndex, setActiveAccordionIndex,
    activeImageAccordion, setActiveImageAccordion,
    dragState, setDragState,
    enterEditorMode, saveAndExitEditor, cancelEditor,
    handleCaptureCamera, handleTestStation,
    handleAddStation, handleDeleteStation, handleMoveStation,
    handleUpdateStationText, handleUpdateStationLightPos,
    handleToggleLightFixedToCamera,
    handleLocalImageUpload, getBgSelectValue,
    handleUpdateStationImage, handleLocal3DImageUpload,
    handleRestoreDefaults
  };
}
