import { useState } from 'react';
import { formatStationConfig, normalizeStationConfig, normalizeStations } from './stations.js';

export function useStationConfigFile({
  alignment,
  editingStations,
  onImportStations,
  onImportAlignment,
  onPreviewStation
}) {
  const [configFileHandle, setConfigFileHandle] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [importError, setImportError] = useState('');
  const [importText, setImportText] = useState('');
  const [showImportExport, setShowImportExport] = useState(false);

  const getCurrentConfigJSON = () => formatStationConfig(editingStations, alignment);

  const openDialog = () => {
    setImportText(getCurrentConfigJSON());
    setShowImportExport(true);
    setImportError('');
  };

  const closeDialog = () => {
    setShowImportExport(false);
  };

  const openConfigFile = async () => {
    setImportError('');

    if (!window.showOpenFilePicker) {
      setImportError('Dieser Browser kann Dateien nicht direkt oeffnen. Nutzen Sie stattdessen "Datei hochladen".');
      return;
    }

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Heidentor JSON',
            accept: { 'application/json': ['.json'] }
          }
        ],
        excludeAcceptAllOption: false,
        multiple: false
      });

      const file = await handle.getFile();
      const text = await file.text();
      setConfigFileHandle(handle);
      setImportText(text);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setImportError(`Fehler beim Oeffnen: ${err.message}`);
      }
    }
  };

  const copyClipboard = () => {
    navigator.clipboard.writeText(importText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const downloadFile = () => {
    const blob = new Blob([getCurrentConfigJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'heidentor-stations.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const overwriteConfigFile = async () => {
    setImportError('');

    if (!configFileHandle?.createWritable) {
      setImportError('Keine ueberschreibbare Datei geoeffnet. Oeffnen Sie zuerst eine JSON-Datei oder nutzen Sie den Download.');
      return;
    }

    try {
      const writable = await configFileHandle.createWritable();
      await writable.write(getCurrentConfigJSON());
      await writable.close();
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setImportError(`Fehler beim Ueberschreiben: ${err.message}`);
    }
  };

  const importJSON = () => {
    try {
      const config = normalizeStationConfig(JSON.parse(importText));
      if (config.stations.length === 0) throw new Error('JSON muss Stationen enthalten.');

      config.stations.forEach((station, index) => {
        if (!station.title || !station.cameraPos || !station.cameraTarget) {
          throw new Error(`Station an Index ${index} fehlt an wichtigen Daten (title, cameraPos, cameraTarget).`);
        }
      });

      const sanitized = normalizeStations(config.stations);

      if (config.alignment) {
        onImportAlignment?.(config.alignment);
      }

      onImportStations(sanitized);
      setShowImportExport(false);
      setImportError('');

      if (sanitized.length > 0) {
        onPreviewStation?.(0, sanitized[0]);
      }
    } catch (err) {
      setImportError(`Fehler beim Import: ${err.message}`);
    }
  };

  const uploadFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result;
      if (typeof text === 'string') {
        setImportText(text);
        setImportError('');
      }
    };
    reader.readAsText(file);
  };

  return {
    configFileHandle,
    copyClipboard,
    copySuccess,
    closeDialog,
    downloadFile,
    importError,
    importJSON,
    importText,
    openConfigFile,
    openDialog,
    overwriteConfigFile,
    setImportText,
    showImportExport,
    uploadFile
  };
}
