import React, { useEffect, useState } from 'react';
import { useAppState } from './hooks/useAppState.js';
import { useScrollMode } from './hooks/useScrollMode.js';
import { useEditorActions } from './hooks/useEditorActions.js';
import { AlignmentPanel } from './components/AlignmentPanel.jsx';
import { StationNavDots } from './components/StationNavDots.jsx';
import { VideoOverlay } from './components/VideoOverlay.jsx';
import { BackgroundLayer } from './components/BackgroundLayer.jsx';
import { NarrativeTextBlock } from './components/NarrativeTextBlock.jsx';
import { AnnotationOverlay } from './components/AnnotationOverlay.jsx';
import { EditorSidebar } from './components/editor/EditorSidebar.jsx';
import { useStationConfigFile } from './useStationConfigFile.js';
import { audioManager } from './utils/audioManager.js';
import { Volume2, VolumeX } from 'lucide-react';

function App() {
  const {
    appState,
    introPhase,
    isIntroActive,
    handleRealign,
    handleResetAlignment,
    handleSkipAlignment,
    getActiveStation,
    getActiveIndex
  } = useAppState();

  const { scrollToStation } = useScrollMode(appState);

  const [isMuted, setIsMuted] = useState(true);

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioManager.setMute(nextMute);
  };

  const editor = useEditorActions(appState);
  
  const configFile = useStationConfigFile({
    alignment: window.appState?.getAlignment?.() ?? appState.alignment,
    editingStations: editor.editingStations,
    onImportAlignment: (alignment) => window.appState?.saveAlignmentConfig?.(alignment),
    onImportStations: editor.setEditingStations,
    onPreviewStation: editor.handleTestStation
  });

  // Trigger editor mode when visiting /edits
  useEffect(() => {
    if (appState.mode !== 'reveal') return;
    const isEditPage = window.location.pathname === '/edits';
    if (isEditPage && appState.stationMode !== 'editor') {
      editor.enterEditorMode();
    }
  }, [appState.mode, appState.stationMode]);

  if (appState.mode === 'loading') {
    return null; // Rendered inside HTML template loading screen
  }

  // 1. ALIGNMENT MODE INTERFACE
  if (appState.mode === 'aligning') {
    return (
      <AlignmentPanel
        appState={appState}
        onResetAlignment={handleResetAlignment}
        onSkipAlignment={handleSkipAlignment}
      />
    );
  }

  const activeStation = getActiveStation(editor.editingStations, editor.editingIndex);
  const activeIndex = getActiveIndex(editor.editingIndex);

  // 2. MAIN MODES (SCROLL, EDITOR, EXPLORE)
  return (
    <div className="w-full relative text-white">
      {/* ─── SCROLL PROGRESS INDICATOR (TOP VIEWPORT) ─── */}
      {appState.stationMode === 'scroll' && (
        <>
          <div 
            className="fixed top-0 left-0 h-[3px] bg-gradient-to-r from-[#8a6f3e] via-[#c9a96e] to-[#f5e0b3] z-50 transition-all duration-300 ease-out shadow-[0_1px_12px_rgba(201,169,110,0.5)]"
            style={{ width: `${(appState.scrollProgress ?? 0) * 100}%` }}
          />
          <button
            onClick={toggleMute}
            className="fixed top-5 left-5 z-40 p-2.5 rounded-full border border-white/10 bg-zinc-950/45 backdrop-blur-xl pointer-events-auto transition-all duration-300 hover:border-[#c9a96e]/40 hover:bg-zinc-900/60 hover:text-[#c9a96e] hover:shadow-[0_0_15px_rgba(201,169,110,0.2)] active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-pointer"
            title={isMuted ? "Ton einschalten" : "Stummschalten"}
          >
            {isMuted ? (
              <VolumeX size={15} className="text-zinc-400 transition-colors" />
            ) : (
              <Volume2 size={15} className="text-[#c9a96e] animate-pulse" />
            )}
          </button>
        </>
      )}
      
      {/* ─── BACKGROUNDS, WATERMARKS & NARRATIVE OVERLAY ─── */}
      {(appState.stationMode === 'scroll' || appState.stationMode === 'editor') && (
        <>
          <BackgroundLayer
            stations={appState.stationMode === 'editor' ? editor.editingStations : appState.stations}
            activeIndex={activeIndex}
            showWatermark={activeIndex === 0}
            useIntroWatermarkFade={isIntroActive && activeIndex === 0}
          />

          <NarrativeTextBlock
            activeStation={activeStation}
            activeIndex={activeIndex}
            appState={appState}
            isIntroActive={isIntroActive}
            introPhase={introPhase}
            onDragStart={editor.setDragState}
          />

          <VideoOverlay
            activeStation={activeStation}
            isEditorMode={appState.stationMode === 'editor'}
            onDragStart={editor.setDragState}
          />

          <AnnotationOverlay
            activeStation={activeStation}
            appState={appState}
            isEditorMode={appState.stationMode === 'editor'}
            onDragAnnotation={editor.handleDragAnnotation}
          />
        </>
      )}

      {/* ─── MODE 1: SCROLLABLE LANDING PAGE (VISITOR MODE) ─── */}
      {appState.stationMode === 'scroll' && (
        <>
          {/* Right Navigation Dot List */}
          <StationNavDots
            stations={appState.stations}
            currentStationIndex={appState.currentStationIndex}
            onScrollToStation={scrollToStation}
          />

          <div
            className={`scroll-prompt-capsule fixed left-1/2 bottom-8 -translate-x-1/2 z-40 bg-[#0a0b10]/60 border border-amber-500/20 backdrop-blur-md rounded-full px-5 py-2.5 text-[9px] uppercase font-bold tracking-[0.2em] text-[#c9a96e] animate-bounce pointer-events-auto shadow-[0_4px_20px_rgba(201,169,110,0.15)] flex items-center gap-2 transition-all duration-700 ease-out hover:border-amber-500/40 hover:shadow-[0_4px_25px_rgba(201,169,110,0.25)] ${
              (appState.scrollProgress ?? 0) < 0.08 && !activeStation?.freeNavigation
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-3 pointer-events-none'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="scroll-prompt-text">Scrollen Sie nach unten · Zeitreise starten ↓</span>
          </div>

          {/* Scroll Spacers (Generates the scroll height of the page) */}
          <div className="w-full relative pointer-events-none">
            {appState.stations.map((s, idx) => (
              <div key={`spacer-${s.id}`} className="h-screen w-full" />
            ))}
          </div>
        </>
      )}

      {/* ─── MODE 3: STATION EDITOR SIDEBAR ─── */}
      {appState.stationMode === 'editor' && (
        <EditorSidebar
          editingStations={editor.editingStations}
          editingIndex={editor.editingIndex}
          activeAccordionIndex={editor.activeAccordionIndex}
          activeImageAccordion={editor.activeImageAccordion}
          placingAnnotationId={editor.placingAnnotationId}
          configFile={configFile}
          onSetActiveAccordion={editor.setActiveAccordionIndex}
          onSetActiveImageAccordion={editor.setActiveImageAccordion}
          onTestStation={editor.handleTestStation}
          onMoveStation={editor.handleMoveStation}
          onDeleteStation={editor.handleDeleteStation}
          onCaptureCamera={editor.handleCaptureCamera}
          onUpdateText={editor.handleUpdateStationText}
          onUpdateLightPos={editor.handleUpdateStationLightPos}
          onToggleLightFixedToCamera={editor.handleToggleLightFixedToCamera}
          onUpdateImage={editor.handleUpdateStationImage}
          onUploadImage={editor.handleLocal3DImageUpload}
          onAddAnnotation={editor.handleAddAnnotation}
          onDeleteAnnotation={editor.handleDeleteAnnotation}
          onUpdateAnnotation={editor.handleUpdateAnnotation}
          onCaptureAnnotation={editor.handleCaptureAnnotation}
          onPlaceAnnotationInScene={editor.handlePlaceAnnotationInScene}
          onUploadAnnotationImages={editor.handleAnnotationImageUpload}
          onLocalBgUpload={editor.handleLocalImageUpload}
          getBgSelectValue={editor.getBgSelectValue}
          onCancel={editor.cancelEditor}
          onSave={editor.saveAndExitEditor}
          onRealign={handleRealign}
          onRestoreDefaults={editor.handleRestoreDefaults}
          onAddStation={editor.handleAddStation}
          localModelName={appState.localModelName}
          localModelStatus={appState.localModelStatus}
          localModelError={editor.localModelPickerError || appState.localModelError}
          onChooseLocalModelFolder={editor.handleLocalModelFolder}
          onLocalModelFiles={editor.handleLocalModelFiles}
          onRemoveLocalModel={editor.handleRemoveLocalModel}
        />
      )}
    </div>
  );
}

export default App;
