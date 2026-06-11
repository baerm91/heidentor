import React from 'react';
import { Settings, X, Plus, RotateCcw, Download, Save } from 'lucide-react';
import { StationEditorCard } from './StationEditorCard.jsx';
import { stripHighlights } from '../../utils/textFormatting.jsx';
import ImportExportDialog from '../../ImportExportDialog.jsx';

export function EditorSidebar({
  editingStations,
  editingIndex,
  activeAccordionIndex,
  activeImageAccordion,
  configFile,
  onSetActiveAccordion,
  onSetActiveImageAccordion,
  onTestStation,
  onMoveStation,
  onDeleteStation,
  onCaptureCamera,
  onUpdateText,
  onUpdateLightPos,
  onToggleLightFixedToCamera,
  onUpdateImage,
  onUploadImage,
  onLocalBgUpload,
  getBgSelectValue,
  onCancel,
  onSave,
  onRealign,
  onRestoreDefaults,
  onAddStation
}) {
  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] bg-zinc-950/85 backdrop-blur-3xl border-l border-white/10 z-50 flex flex-col pointer-events-auto text-white shadow-2xl">
      
      {/* Editor Header */}
      <div className="p-5 border-b border-white/10 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-amber-400 animate-pulse" />
          <h2 className="font-serif text-lg font-bold">Stationen-Editor</h2>
        </div>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Station Navigation Tabs */}
      <div className="px-5 py-3 border-b border-white/10 bg-zinc-950/70 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
          {editingStations.map((station, index) => (
            <button
              key={`editor-nav-${station.id}`}
              onClick={() => onTestStation(index, station)}
              className={`shrink-0 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                editingIndex === index
                  ? 'bg-amber-500 text-zinc-950 border-amber-400'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-amber-300 hover:border-amber-500/40'
              }`}
              title={stripHighlights(station.title)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Station List (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 scrollbar-thin">
        {editingStations.map((station, index) => (
          <StationEditorCard
            key={station.id}
            station={station}
            index={index}
            editingIndex={editingIndex}
            totalStations={editingStations.length}
            activeAccordionIndex={activeAccordionIndex}
            activeImageAccordion={activeImageAccordion}
            onSetActiveAccordion={onSetActiveAccordion}
            onSetActiveImageAccordion={onSetActiveImageAccordion}
            onMoveStation={onMoveStation}
            onDeleteStation={onDeleteStation}
            onTestStation={onTestStation}
            onCaptureCamera={onCaptureCamera}
            onUpdateText={onUpdateText}
            onUpdateLightPos={onUpdateLightPos}
            onToggleLightFixedToCamera={onToggleLightFixedToCamera}
            onUpdateImage={onUpdateImage}
            onUploadImage={onUploadImage}
            onLocalBgUpload={onLocalBgUpload}
            getBgSelectValue={getBgSelectValue}
          />
        ))}

        {/* Add New Station */}
        <button 
          onClick={onAddStation}
          className="w-full border border-dashed border-zinc-700 hover:border-amber-500/50 hover:bg-zinc-900/30 rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-all outline-none"
        >
          <Plus size={14} />
          <span>Neue Station hinzufügen</span>
        </button>
      </div>

      {/* Editor Footer Action Panel */}
      <div className="p-5 border-t border-white/10 shrink-0 bg-zinc-950 flex flex-col gap-3">
        <button
          onClick={onRealign}
          className="w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl py-2.5 text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5 transition-all"
        >
          <RotateCcw size={14} />
          <span>Modelle mit 3 Punkten ausrichten</span>
        </button>

        <div className="flex gap-2">
          <button 
            onClick={onRestoreDefaults}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-all"
          >
            Standard
          </button>
          <button 
            onClick={configFile.openDialog}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1 transition-all"
          >
            <Download size={12} />
            <span>Imp. / Exp.</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onCancel}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2.5 text-xs font-semibold transition-all"
          >
            Abbrechen
          </button>
          
          <button 
            onClick={onSave}
            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition-all"
          >
            <Save size={14} />
            <span>Speichern & Schließen</span>
          </button>
        </div>
      </div>

      {/* ─── IMPORT / EXPORT MODAL DIALOG ─── */}
      {configFile.showImportExport && (
        <ImportExportDialog
          configFileHandle={configFile.configFileHandle}
          copySuccess={configFile.copySuccess}
          importError={configFile.importError}
          importText={configFile.importText}
          onClose={configFile.closeDialog}
          onCopyClipboard={configFile.copyClipboard}
          onDownloadFile={configFile.downloadFile}
          onFileUpload={configFile.uploadFile}
          onImportJSON={configFile.importJSON}
          onImportTextChange={configFile.setImportText}
          onOpenConfigFile={configFile.openConfigFile}
          onOverwriteConfigFile={configFile.overwriteConfigFile}
        />
      )}
    </div>
  );
}
