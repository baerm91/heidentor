import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  RotateCcw, 
  Eye, 
  Sliders, 
  Compass, 
  BookOpen, 
  CornerDownRight, 
  Maximize2, 
  Calendar, 
  MapPin, 
  CheckCircle2, 
  Hourglass,
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  X, 
  Play, 
  Save,
  Settings
} from 'lucide-react';
import ImportExportDialog from './ImportExportDialog.jsx';
import { defaultStations } from './stations.js';
import { useStationConfigFile } from './useStationConfigFile.js';

// Helper to parse *highlight* syntax into gold-colored elements
const parseTextWithHighlights = (text, isDescription = false) => {
  if (!text) return "";
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <span key={index} className="gold-text-gradient font-serif font-black tracking-wide">
          {part.slice(1, -1)}
        </span>
      );
    }
    if (isDescription) {
      return (
        <span key={index} className="text-[#c8c3bc] font-serif font-light">
          {part}
        </span>
      );
    }
    return (
      <span key={index} className="stone-text-gradient font-serif font-bold">
        {part}
      </span>
    );
  });
};

const stripHighlights = (text) => {
  if (!text) return "";
  return text.replace(/\*/g, '');
};

function App() {
  const [appState, setAppState] = useState({
    mode: 'loading',
    alignStep: 0,
    alignTarget: 'ruin',
    viewMode: 'reveal',
    revealRadius: 0.26,
    revealSoftness: 0.05,
    lensZoom: 1.0,
    stationMode: 'scroll',
    stations: [],
    alignment: null,
    currentStationIndex: 0,
    scrollProgress: 0,
    hasUserManipulatedCamera: false
  });

  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'architecture' | 'facts'
  
  // Editor-specific states
  const [editingStations, setEditingStations] = useState([]);
  const [editingIndex, setEditingIndex] = useState(0);
  const [dragState, setDragState] = useState(null);
  const lastStationAutoScrollRef = useRef(false);

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

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, editingStations, editingIndex]);

  // Synchronize React state with Three.js state bridge
  useEffect(() => {
    if (window.appState) {
      window.appState.onStateChange = (newState) => {
        setAppState({ ...newState });
      };
      setAppState({ ...window.appState });
    }
  }, []);

  useEffect(() => {
    if (appState.mode !== 'reveal') return;

    const isEditPage = window.location.pathname === '/edits';
    if (isEditPage && appState.stationMode !== 'editor') {
      enterEditorMode();
    }
  }, [appState.mode, appState.stationMode, appState.stations]);

  // Scroll listener for landing page scroll mode
  useEffect(() => {
    if (appState.mode === 'reveal' && appState.stationMode === 'scroll') {
      document.body.style.overflowY = 'auto';
      document.body.style.overflowX = 'hidden';

      const handleScroll = () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const rawProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
        const progress = Math.max(0, Math.min(1, rawProgress));
        window.appState?.updateScrollProgress?.(progress);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll(); // initial trigger

      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    } else if (appState.stationMode === 'editor') {
      document.body.style.overflow = 'hidden';
    }
  }, [appState.mode, appState.stationMode]);

  useEffect(() => {
    if (appState.mode !== 'reveal' || appState.stationMode !== 'scroll') return;
    if (appState.stations.length < 2) return;

    const lastIndex = appState.stations.length - 1;
    const isLastStation = appState.currentStationIndex === lastIndex;

    if (!isLastStation) {
      lastStationAutoScrollRef.current = false;
      return;
    }

    if (lastStationAutoScrollRef.current || appState.scrollProgress >= 0.98) return;

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;

    lastStationAutoScrollRef.current = true;
    window.scrollTo({
      top: maxScroll,
      behavior: 'smooth'
    });
  }, [
    appState.currentStationIndex,
    appState.mode,
    appState.scrollProgress,
    appState.stationMode,
    appState.stations.length
  ]);

  // Safe wrapper for trigger functions
  const handleRealign = () => window.appState?.realign?.();
  const handleResetAlignment = () => window.appState?.resetAlignment?.();
  const handleSkipAlignment = () => window.appState?.skipAlignment?.();
  
  const handleSetViewMode = (mode) => window.appState?.setViewMode?.(mode);
  const handleSetRadius = (r) => window.appState?.setRevealRadius?.(parseFloat(r));
  const handleSetSoftness = (s) => window.appState?.setRevealSoftness?.(parseFloat(s));
  const handleSetLensZoom = (z) => window.appState?.setLensZoom?.(parseFloat(z));

  // Station mode triggers
  const enterEditorMode = () => {
    // Populate working copy of stations
    const currentStations = JSON.parse(JSON.stringify(appState.stations));
    setEditingStations(currentStations);
    setEditingIndex(appState.currentStationIndex);
    window.appState?.setStationMode?.('editor');
  };

  const saveAndExitEditor = () => {
    window.appState?.saveStations?.(editingStations);
    if (window.location.pathname === '/edits') {
      return;
    }
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

  const scrollToStation = (index) => {
    if (appState.stationMode !== 'scroll') return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const intervalSize = 1.0 / (appState.stations.length - 1);
    const scrollTargetFraction = index * intervalSize;
    window.scrollTo({
      top: scrollTargetFraction * maxScroll,
      behavior: 'smooth'
    });
  };

  // Editor Actions
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

  const configFile = useStationConfigFile({
    alignment: window.appState?.getAlignment?.() ?? appState.alignment,
    editingStations,
    onImportAlignment: (alignment) => window.appState?.saveAlignmentConfig?.(alignment),
    onImportStations: setEditingStations,
    onPreviewStation: handleTestStation
  });

  const handleAddStation = () => {
    const coords = window.appState?.captureCamera?.() || {
      cameraPos: { x: 0, y: 10, z: 22 },
      cameraTarget: { x: 0, y: 3.5, z: 0 }
    };

    const newStation = {
      id: `station_${Date.now()}`,
      title: `Neue Station ${editingStations.length + 1}`,
      description: "Beschreiben Sie hier, was an dieser Station zu sehen ist.",
      viewMode: appState.viewMode || "reveal",
      cameraPos: coords.cameraPos,
      cameraTarget: coords.cameraTarget,
      revealRadius: appState.revealRadius || 0.26,
      revealSoftness: appState.revealSoftness || 0.05,
      bgImage: "",
      textX: 10,
      textY: 35,
      subTitle: "",
      subDescription: "",
      videoUrl: "",
      videoX: 58,
      videoY: 22,
      videoWidth: 28,
      videoHeight: 18,
      textLayer: "front",
      milkyBg: false
    };

    const updated = [...editingStations, newStation];
    setEditingStations(updated);
    setEditingIndex(updated.length - 1);
  };

  const handleDeleteStation = (index) => {
    if (editingStations.length <= 1) {
      alert("Es muss mindestens eine Station übrig bleiben!");
      return;
    }
    const updated = editingStations.filter((_, idx) => idx !== index);
    setEditingStations(updated);
    if (editingIndex >= updated.length) {
      setEditingIndex(updated.length - 1);
    }
  };

  const handleMoveStation = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === editingStations.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...editingStations];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    
    // Follow the selected card index
    if (editingIndex === index) {
      setEditingIndex(targetIdx);
    } else if (editingIndex === targetIdx) {
      setEditingIndex(index);
    }

    setEditingStations(updated);
  };

  const handleUpdateStationText = (index, field, val) => {
    const updated = [...editingStations];
    updated[index][field] = val;
    setEditingStations(updated);

    if (editingIndex === index) {
      if (field === 'viewMode') {
        window.appState?.setViewMode?.(val);
      } else if (field === 'revealRadius') {
        window.appState?.setRevealRadius?.(parseFloat(val));
      } else if (field === 'revealSoftness') {
        window.appState?.setRevealSoftness?.(parseFloat(val));
      }
    }
  };

  const handleLocalImageUpload = (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Warnung: Das ausgewählte Bild ist sehr groß (" + (file.size / (1024 * 1024)).toFixed(1) + " MB). Bilder über 2 MB können das Limit des lokalen Speichers (LocalStorage) überschreiten.");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === 'string') {
        handleUpdateStationText(index, 'bgImage', dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const getBgSelectValue = (bgImage) => {
    if (!bgImage) return "";
    if (['roman_blueprint_bg.png', 'star_sky_bg.png', 'heidentor_blueprint.png'].includes(bgImage)) return bgImage;
    if (bgImage.startsWith('data:image/')) return 'upload';
    return 'custom';
  };

  const handleRestoreDefaults = () => {
    if (window.confirm("Möchten Sie wirklich die vordefinierten Standard-Stationen wiederherstellen? Ihre Änderungen gehen verloren.")) {
      setEditingStations(JSON.parse(JSON.stringify(defaultStations)));
    }
  };

  if (appState.mode === 'loading') {
    return null; // Rendered inside HTML template loading screen
  }

  // 1. ALIGNMENT MODE INTERFACE
  if (appState.mode === 'aligning') {
    return (
      <div className="absolute inset-0 w-full h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 text-white pointer-events-none select-none">
        <header className="flex justify-between items-start w-full z-10 pointer-events-none">
          <div className="flex items-center gap-3 bg-zinc-950/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:px-5 pointer-events-auto">
            <span className="text-2xl text-amber-400 filter drop-shadow-[0_0_8px_rgba(201,169,110,0.5)]">⛩</span>
            <div>
              <h1 className="font-serif text-lg sm:text-xl font-bold tracking-wide">Heidentor</h1>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Carnuntum · Zeitreise</p>
            </div>
          </div>
        </header>

        <div className="w-full lg:w-[480px] bg-zinc-950/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5 ml-auto mt-auto pointer-events-auto">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Compass className="text-amber-400 animate-spin" style={{ animationDuration: '6s' }} size={18} />
                <h3 className="text-sm font-semibold tracking-wide uppercase">Modell-Ausrichtung</h3>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider">
                Kalibrierung
              </span>
            </div>
            
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Verknüpfen Sie **3 identische Punkte** auf beiden Modellen. Wählen Sie zuerst 3 Referenzpunkte auf der Ruine und danach dieselben 3 Punkte auf der Rekonstruktion.
            </p>

            {/* Stepper progress dots */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { id: 0, label: 'Ruine', sub: 'Punkt 1' },
                { id: 1, label: 'Ruine', sub: 'Punkt 2' },
                { id: 2, label: 'Ruine', sub: 'Punkt 3' },
                { id: 3, label: 'Rekon.', sub: 'Punkt 1' },
                { id: 4, label: 'Rekon.', sub: 'Punkt 2' },
                { id: 5, label: 'Rekon.', sub: 'Punkt 3' }
              ].map((s) => {
                const isDone = appState.alignStep > s.id;
                const isActive = appState.alignStep === s.id;
                return (
                  <div 
                    key={s.id} 
                    className={`flex flex-col items-center p-2 rounded-lg transition-all duration-300 border ${
                      isDone 
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' 
                        : isActive 
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 animate-pulse' 
                          : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold tracking-widest">{s.label}</div>
                    <div className="text-xs font-semibold mt-1">{s.sub}</div>
                    <div className="mt-1 text-[9px]">{isDone ? '✓ Gesetzt' : isActive ? 'Klicken…' : '—'}</div>
                  </div>
                );
              })}
            </div>

            {/* Status instructions */}
            <div className="mt-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-center">
              {appState.alignTarget === 'ruin' && (
                <span className="text-xs text-amber-300 font-medium flex items-center justify-center gap-1.5">
                  <CornerDownRight size={14} className="animate-bounce" />
                  Klicken Sie auf Punkt {appState.alignStep + 1} auf der <strong className="text-amber-400">Ruine (Mitte)</strong>
                </span>
              )}
              {appState.alignTarget === 'recon' && (
                <span className="text-xs text-cyan-300 font-medium flex items-center justify-center gap-1.5">
                  <CornerDownRight size={14} className="animate-bounce" />
                  Klicken Sie auf Punkt {appState.alignStep - 2} auf der <strong className="text-cyan-400">Rekonstruktion (Mitte)</strong>
                </span>
              )}
              {appState.alignTarget === 'done' && (
                <span className="text-xs text-emerald-400 font-medium flex items-center justify-center gap-2">
                  <Hourglass size={14} className="animate-spin" />
                  Ausrichtung komplett! Modelle werden verschmolzen...
                </span>
              )}
            </div>

            <div className="flex gap-2 mt-2">
              <button onClick={handleResetAlignment} className="flex-1 bg-zinc-900/80 hover:bg-zinc-800 active:scale-98 border border-zinc-700/50 rounded-xl py-2.5 text-xs font-semibold transition-all">
                Zurücksetzen
              </button>
              <button onClick={handleSkipAlignment} className="flex-1 bg-zinc-900/80 hover:bg-zinc-800 active:scale-98 border border-zinc-700/50 rounded-xl py-2.5 text-xs font-semibold transition-all">
                Überspringen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. MAIN MODES (SCROLL, EDITOR, EXPLORE)
  return (
    <div className="w-full relative text-white">
      
      {/* ─── FIXED INTERFACE OVERLAYS ─── */}
      
      {/* Global Header */}
      {false && (
        <header className="fixed top-4 left-4 right-4 flex justify-between items-center z-40 pointer-events-none">
          <div className="flex items-center gap-3 bg-zinc-950/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:px-5 pointer-events-auto">
            <span className="text-2xl text-amber-400 filter drop-shadow-[0_0_8px_rgba(201,169,110,0.5)]">⛩</span>
            <div>
              <h1 className="font-serif text-lg sm:text-xl font-bold tracking-wide">Heidentor</h1>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Carnuntum · Zeitreise</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {appState.stationMode === 'scroll' && appState.currentStationIndex > 0 && (
              <>
                <button 
                  onClick={enterEditorMode}
                  className="flex items-center gap-2 bg-zinc-950/70 hover:bg-zinc-900 active:scale-95 border border-white/10 backdrop-blur-xl rounded-2xl px-4 py-3 text-xs font-medium tracking-wide transition-all duration-300"
                >
                  <Settings size={14} className="text-zinc-400" />
                  <span>Editor</span>
                </button>
                <button 
                  onClick={handleRealign}
                  className="flex items-center gap-2 bg-zinc-950/70 hover:bg-amber-500/10 active:scale-95 hover:border-amber-500/30 border border-white/10 backdrop-blur-xl rounded-2xl px-4 py-3 text-xs font-medium tracking-wide transition-all duration-300"
                >
                  <RotateCcw size={14} className="text-amber-400" />
                  <span>Neu ausrichten</span>
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {/* ─── BACKGROUNDS, WATERMARKS & NARRATIVE OVERLAY ─── */}
      {(appState.stationMode === 'scroll' || appState.stationMode === 'editor') && (
        <>
          {/* Background images stack (placed behind the 3D model) */}
          {document.getElementById('bg-root') && createPortal(
            <>
              {/* Background images stack (placed behind the 3D model) */}
              <div className="fixed inset-0 pointer-events-none">
                {(appState.stationMode === 'editor' ? editingStations : appState.stations).map((s, idx) => {
                  if (!s.bgImage) return null;
                  
                  const isActive = appState.stationMode === 'editor'
                    ? editingIndex === idx
                    : appState.currentStationIndex === idx;

                  return (
                    <div
                      key={`bg-img-${s.id}`}
                      className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-in-out"
                      style={{
                        backgroundImage: `url(${s.bgImage})`,
                        opacity: isActive ? 0.35 : 0,
                      }}
                    />
                  );
                })}
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-[#010101] opacity-[0.97]" />
              </div>

              {/* Giant background typography "HEIDENTOR" */}
              {(() => {
                const showWatermark = appState.stationMode === 'editor'
                  ? editingIndex === 0
                  : appState.currentStationIndex === 0;
                return (
                  <div 
                    className={`fixed inset-x-0 w-screen top-[13%] sm:top-[10%] md:top-[8%] text-center pointer-events-none select-none transition-all duration-1000 ease-out z-[2] overflow-visible ${
                      showWatermark 
                        ? 'opacity-100 scale-100' 
                        : 'opacity-0 scale-95'
                    }`}
                  >
                    <span className="hero-watermark-title font-serif watermark-text-gradient uppercase leading-none block select-none whitespace-nowrap overflow-visible">
                      HEIDENTOR
                    </span>
                  </div>
                );
              })()}

              {/* Subtle organic noise/stone texture overlay */}
              <div className="noise-overlay" />
            </>,
            document.getElementById('bg-root')
          )}

          {/* Unified Floating Narrative Text Block */}
          {(() => {
            const activeStation = appState.stationMode === 'editor'
              ? editingStations[editingIndex]
              : appState.stations[appState.currentStationIndex];
            const activeIndex = appState.stationMode === 'editor'
              ? editingIndex
              : appState.currentStationIndex;

            if (!activeStation) return null;

            const isLastStation = appState.stationMode === 'scroll' && activeIndex === appState.stations.length - 1;
            const shouldFadeOut = isLastStation && appState.hasUserManipulatedCamera;

            // Render behind the 3D model if configured and NOT in editor mode
            const renderBehind = appState.stationMode !== 'editor' && activeStation.textLayer === 'behind';

            const textBlockElement = (
              <div 
                key={activeStation.id}
                className={`fixed w-full max-w-lg pointer-events-none text-left transition-all duration-1000 ease-in-out station-text-panel ${
                  shouldFadeOut ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
                }`}
                style={{
                  left: `${activeStation.textX ?? 10}%`,
                  top: `${activeStation.textY ?? 35}%`,
                  zIndex: renderBehind ? 5 : 30
                }}
              >
                <div 
                  className={`animate-blur-fade-up flex flex-col gap-1 select-none relative ${
                    shouldFadeOut ? 'pointer-events-none' : 'pointer-events-auto'
                  } ${
                    activeStation.milkyBg ? 'milky-glass-panel shadow-2xl' : ''
                  } ${
                    appState.stationMode === 'editor' 
                      ? `border border-dashed border-amber-500/50 p-6 rounded-2xl cursor-move ${activeStation.milkyBg ? '' : 'bg-zinc-950/45'}` 
                      : ''
                  }`}
                  onMouseDown={(e) => {
                    if (appState.stationMode !== 'editor') return;
                    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
                    e.preventDefault();
                    setDragState({
                      type: 'text',
                      startX: e.clientX,
                      startY: e.clientY,
                      startValueX: activeStation.textX ?? 10,
                      startValueY: activeStation.textY ?? 35
                    });
                  }}
                >
                  {appState.stationMode === 'editor' && (
                    <div className="absolute -top-3 -left-3 bg-amber-500 text-zinc-950 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded shadow-lg flex items-center gap-1.5">
                      <span>✦</span>
                      <span>Ziehen zum Verschieben</span>
                      {activeStation.textLayer === 'behind' && (
                        <span className="text-[8px] bg-amber-600 text-white rounded px-1.5 py-0.5 normal-case font-normal font-sans">Hinter Modell (im Vorschaumodus)</span>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <h1 className="station-title font-serif flex flex-col">
                    {(activeStation.title || "").split('\n').map((line, idx) => (
                      <span key={idx} className="station-title-line block">
                        {parseTextWithHighlights(line)}
                      </span>
                    ))}
                  </h1>

                  {/* Elegant Gold Divider (like in the museum reference image) */}
                  <div className="flex items-center gap-4 my-5 w-full max-w-md">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9a96e]/60 to-[#c9a96e]/80"></div>
                    <div className="w-2.5 h-2.5 rotate-45 border border-[#c9a96e] bg-[#0c0d12]/80 flex-shrink-0 shadow-[0_0_8px_rgba(201,169,110,0.5)]"></div>
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#c9a96e]/60 to-[#c9a96e]/80"></div>
                  </div>

                  {/* Description */}
                  <p className="text-[#c8c3bc] font-serif text-xs sm:text-sm sm:leading-relaxed max-w-md font-light text-justify">
                    {parseTextWithHighlights(activeStation.description, true)}
                  </p>

                  {/* Reveal mode notification indicator */}
                  {activeStation.viewMode === 'reveal' && (
                    <div className="mt-4 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[10px] leading-relaxed text-amber-400/90 flex gap-2 items-start max-w-md">
                      <Compass size={12} className="mt-0.5 shrink-0 animate-pulse" />
                      <span>Portal aktiv: Bewegen Sie Ihren Mauszeiger über das Modell, um die Römerzeit freizulegen.</span>
                    </div>
                  )}

                  {/* Sub-block section at the bottom */}
                  {(activeStation.subTitle || activeStation.subDescription) && (
                    <div className="flex items-start gap-4 mt-8 border-t border-white/10 pt-6 max-w-sm">
                      <div className="w-7 h-7 rounded-full border border-[#c9a96e]/30 flex items-center justify-center shrink-0 text-[#c9a96e] bg-[#c9a96e]/5 mt-0.5 shadow-[0_0_8px_rgba(201,169,110,0.1)]">
                        <span className="text-[10px] font-serif text-[#c9a96e]">✦</span>
                      </div>
                      <div>
                        {activeStation.subTitle && (
                          <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#c9a96e] mb-1 font-serif">
                            {parseTextWithHighlights(activeStation.subTitle)}
                          </h4>
                        )}
                        {activeStation.subDescription && (
                           <p className="text-[11px] leading-relaxed text-zinc-400 font-light">
                             {activeStation.subDescription.split('\n').map((line, idx) => (
                               <React.Fragment key={idx}>
                                 {idx > 0 && <br />}
                                 {parseTextWithHighlights(line, true)}
                               </React.Fragment>
                             ))}
                           </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );

            if (renderBehind && document.getElementById('bg-root')) {
              return createPortal(textBlockElement, document.getElementById('bg-root'));
            }
            return textBlockElement;
          })()}

          {/* Optional station video overlay */}
          {(() => {
            const activeStation = appState.stationMode === 'editor'
              ? editingStations[editingIndex]
              : appState.stations[appState.currentStationIndex];

            if (!activeStation?.videoUrl) return null;

            return (
              <div
                className={`fixed z-30 transition-all duration-700 ease-in-out station-video-panel ${
                  appState.stationMode === 'editor'
                    ? 'pointer-events-auto cursor-move border border-dashed border-cyan-400/60 bg-zinc-950/35 p-2 rounded-xl'
                    : 'pointer-events-auto'
                }`}
                style={{
                  left: `${activeStation.videoX ?? 58}%`,
                  top: `${activeStation.videoY ?? 22}%`,
                  width: `${activeStation.videoWidth ?? 28}vw`,
                  height: `${activeStation.videoHeight ?? 18}vw`,
                  minWidth: '220px',
                  minHeight: '124px'
                }}
                onMouseDown={(e) => {
                  if (appState.stationMode !== 'editor') return;
                  e.preventDefault();
                  setDragState({
                    type: 'video',
                    startX: e.clientX,
                    startY: e.clientY,
                    startValueX: activeStation.videoX ?? 58,
                    startValueY: activeStation.videoY ?? 22
                  });
                }}
              >
                {appState.stationMode === 'editor' && (
                  <div className="absolute -top-3 -left-3 bg-cyan-400 text-zinc-950 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded shadow-lg">
                    Video ziehen
                  </div>
                )}
                <iframe
                  title={`Video ${activeStation.title || 'Station'}`}
                  src={activeStation.videoUrl}
                  className="w-full h-full rounded-lg border border-white/10 bg-black shadow-2xl"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                {appState.stationMode === 'editor' && (
                  <div className="absolute inset-2 rounded-lg bg-transparent" />
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* ─── MODE 1: SCROLLABLE LANDING PAGE (VISITOR MODE) ─── */}
      {appState.stationMode === 'scroll' && (
        <>
          {/* Right Navigation Dot List (Fixed, visible for station 2+) */}
          {appState.currentStationIndex > 0 && (
            <div className="fixed right-4 sm:right-6 md:right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-4 pointer-events-auto items-end select-none station-dots-nav">
              {appState.stations.map((s, idx) => {
                const isActive = appState.currentStationIndex === idx;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollToStation(idx)}
                    className="flex items-center gap-2 group outline-none"
                    title={stripHighlights(s.title)}
                  >
                    <span className={`dot-label text-[10px] font-medium tracking-wide transition-all duration-300 opacity-0 group-hover:opacity-100 pr-1 ${isActive ? 'text-amber-400 font-bold opacity-100' : 'text-zinc-500'}`}>
                      {stripHighlights(s.title)}
                    </span>
                    <span className={`w-3 h-3 rounded-full border transition-all duration-300 flex items-center justify-center ${
                      isActive 
                        ? 'border-amber-400 bg-amber-400/25 scale-125 shadow-[0_0_8px_rgba(245,158,11,0.5)]' 
                        : 'border-zinc-700 bg-zinc-950/80 group-hover:border-zinc-400'
                    }`}>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                    </span>
                  </button>
                );
              })}

            </div>
          )}

          {/* Scroll Spacers (Generates the scroll height of the page) */}
          <div className="w-full relative pointer-events-none">
            {appState.stations.map((s, idx) => (
              <div key={`spacer-${s.id}`} className="h-screen w-full flex items-end justify-center pb-8">
                {idx === 0 && (
                  <div className="bg-zinc-950/40 border border-white/5 rounded-full px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-400 animate-bounce pointer-events-auto">
                    Scrollen Sie nach unten · Zeitreise starten ↓
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── MODE 3: STATION EDITOR SIDEBAR ─── */}
      {appState.stationMode === 'editor' && (
        <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] bg-zinc-950/85 backdrop-blur-3xl border-l border-white/10 z-50 flex flex-col pointer-events-auto text-white shadow-2xl">
          
          {/* Editor Header */}
          <div className="p-5 border-b border-white/10 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-amber-400 animate-pulse" />
              <h2 className="font-serif text-lg font-bold">Stationen-Editor</h2>
            </div>
            <button onClick={cancelEditor} className="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-3 border-b border-white/10 bg-zinc-950/70 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
              {editingStations.map((station, index) => (
                <button
                  key={`editor-nav-${station.id}`}
                  onClick={() => handleTestStation(index, station)}
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
              <div 
                key={station.id} 
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 relative transition-all hover:border-zinc-700"
              >
                {/* Station Badge and Actions */}
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                    Station #{index + 1}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => handleMoveStation(index, 'up')} 
                      disabled={index === 0}
                      className="p-1 rounded bg-zinc-950/50 hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none"
                      title="Nach oben verschieben"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button 
                      onClick={() => handleMoveStation(index, 'down')} 
                      disabled={index === editingStations.length - 1}
                      className="p-1 rounded bg-zinc-950/50 hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none"
                      title="Nach unten verschieben"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button 
                      onClick={() => handleDeleteStation(index)}
                      className="p-1 rounded bg-red-950/30 hover:bg-red-900/40 text-red-400"
                      title="Station löschen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Title Input */}
                <div className="flex flex-col gap-1 text-left">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Titel</label>
                    <span className="text-[9px] text-zinc-550 italic">Nutzen Sie \n für Zeilenumbrüche, *text* für Gold-Effekt</span>
                  </div>
                  <textarea 
                    rows="2"
                    value={station.title}
                    onChange={(e) => handleUpdateStationText(index, 'title', e.target.value)}
                    className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>

                {/* Description Textarea */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Beschreibung</label>
                  <textarea 
                    rows="3"
                    value={station.description}
                    onChange={(e) => handleUpdateStationText(index, 'description', e.target.value)}
                    className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                  />
                </div>

                {/* X / Y Position Sliders */}
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      <span>Horizontal (X)</span>
                      <span className="text-amber-400 font-normal font-mono">{station.textX ?? 10}%</span>
                    </div>
                    <input 
                      type="range" min="5" max="80" step="1" 
                      value={station.textX ?? 10} 
                      onChange={(e) => handleUpdateStationText(index, 'textX', parseInt(e.target.value))}
                      className="w-full accent-amber-500 h-1 bg-zinc-800 rounded cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      <span>Vertikal (Y)</span>
                      <span className="text-amber-400 font-normal font-mono">{station.textY ?? 35}%</span>
                    </div>
                    <input 
                      type="range" min="5" max="80" step="1" 
                      value={station.textY ?? 35} 
                      onChange={(e) => handleUpdateStationText(index, 'textY', parseInt(e.target.value))}
                      className="w-full accent-amber-500 h-1 bg-zinc-800 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Text Layer & Milky Background Selection */}
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Text-Ebene</label>
                    <select
                      value={station.textLayer ?? 'front'}
                      onChange={(e) => handleUpdateStationText(index, 'textLayer', e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="front">Vor dem Modell</option>
                      <option value="behind">Hinter dem Modell</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 justify-between">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Hintergrund</label>
                    <label className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs cursor-pointer hover:border-zinc-700 select-none h-[30px]">
                      <input 
                        type="checkbox"
                        checked={!!station.milkyBg}
                        onChange={(e) => handleUpdateStationText(index, 'milkyBg', e.target.checked)}
                        className="accent-amber-500 rounded border-zinc-700 bg-zinc-900"
                      />
                      <span className="text-zinc-300">Milchig</span>
                    </label>
                  </div>
                </div>

                {/* Background Image Selection */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Hintergrundbild</label>
                  <select
                    value={getBgSelectValue(station.bgImage)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'upload') {
                        handleUpdateStationText(index, 'bgImage', 'data:image/placeholder;base64,');
                      } else if (val === 'custom') {
                        handleUpdateStationText(index, 'bgImage', 'custom_image_url.png');
                      } else {
                        handleUpdateStationText(index, 'bgImage', val);
                      }
                    }}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="">Keines (Standard dunkel)</option>
                    <option value="roman_blueprint_bg.png">Römische Bauzeichnung (Blaupause)</option>
                    <option value="star_sky_bg.png">Sternenhimmel (Dramatisch)</option>
                    <option value="heidentor_blueprint.png">Heidentor Aufriss-Zeichnung</option>
                    <option value="upload">Eigene Bilddatei hochladen (.png, .jpg)</option>
                    <option value="custom">Externe URL / Pfad</option>
                  </select>

                  {getBgSelectValue(station.bgImage) === 'upload' && (
                    <div className="mt-1 flex flex-col gap-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleLocalImageUpload(index, e)}
                        className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-amber-500/50"
                      />
                      {station.bgImage && station.bgImage.startsWith('data:image/') && !station.bgImage.includes('placeholder') && (
                        <span className="text-[9px] text-emerald-400 font-semibold">✓ Bild erfolgreich hochgeladen und konvertiert</span>
                      )}
                    </div>
                  )}

                  {getBgSelectValue(station.bgImage) === 'custom' && (
                    <input 
                      type="text" 
                      placeholder="z.B. https://example.com/bild.jpg"
                      value={station.bgImage === 'custom_image_url.png' ? '' : station.bgImage}
                      onChange={(e) => handleUpdateStationText(index, 'bgImage', e.target.value)}
                      className="w-full mt-1 bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
                    />
                  )}
                </div>

                {/* Subtitle / Subdescription */}
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Untertitel (unten)</label>
                    <input 
                      type="text" 
                      placeholder="z.B. Ein Tor zwischen Welten"
                      value={station.subTitle ?? ''}
                      onChange={(e) => handleUpdateStationText(index, 'subTitle', e.target.value)}
                      className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Detailtext (unten)</label>
                    <textarea 
                      rows="2"
                      placeholder="z.B. Zeuge einer Ära..."
                      value={station.subDescription ?? ''}
                      onChange={(e) => handleUpdateStationText(index, 'subDescription', e.target.value)}
                      className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Video iframe */}
                <div className="flex flex-col gap-2 text-left border border-zinc-850/70 bg-zinc-950/30 rounded-xl p-3">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Video iframe</label>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/embed/..."
                    value={station.videoUrl ?? ''}
                    onChange={(e) => handleUpdateStationText(index, 'videoUrl', e.target.value)}
                    className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-400/50"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        <span>Video X</span>
                        <span className="text-cyan-300 font-normal font-mono">{station.videoX ?? 58}%</span>
                      </div>
                      <input
                        type="range" min="2" max="85" step="1"
                        value={station.videoX ?? 58}
                        onChange={(e) => handleUpdateStationText(index, 'videoX', parseInt(e.target.value))}
                        className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        <span>Video Y</span>
                        <span className="text-cyan-300 font-normal font-mono">{station.videoY ?? 22}%</span>
                      </div>
                      <input
                        type="range" min="2" max="85" step="1"
                        value={station.videoY ?? 22}
                        onChange={(e) => handleUpdateStationText(index, 'videoY', parseInt(e.target.value))}
                        className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        <span>Breite</span>
                        <span className="text-cyan-300 font-normal font-mono">{station.videoWidth ?? 28}vw</span>
                      </div>
                      <input
                        type="range" min="16" max="48" step="1"
                        value={station.videoWidth ?? 28}
                        onChange={(e) => handleUpdateStationText(index, 'videoWidth', parseInt(e.target.value))}
                        className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        <span>Höhe</span>
                        <span className="text-cyan-300 font-normal font-mono">{station.videoHeight ?? 18}vw</span>
                      </div>
                      <input
                        type="range" min="9" max="32" step="1"
                        value={station.videoHeight ?? 18}
                        onChange={(e) => handleUpdateStationText(index, 'videoHeight', parseInt(e.target.value))}
                        className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* View Mode Dropdown */}
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Ansichts-Modus</label>
                    <select
                      value={station.viewMode}
                      onChange={(e) => handleUpdateStationText(index, 'viewMode', e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="ruin">Gegenwart (Ruine)</option>
                      <option value="recon">Rekonstruktion</option>
                      <option value="reveal">Zeitportal (Reveal)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 justify-end">
                    <button 
                      onClick={() => handleTestStation(index, station)}
                      className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg py-1.5 text-xs flex items-center justify-center gap-1 text-zinc-300 font-medium"
                    >
                      <Play size={10} className="text-amber-500" />
                      <span>Kamera testen</span>
                    </button>
                  </div>
                </div>

                {/* Camera Pos capture */}
                <div className="flex gap-2 items-center bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-850 mt-1">
                  <div className="flex-1 text-left">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block">Kamera-Koordinaten</span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Pos: {station.cameraPos.x.toFixed(1)}, {station.cameraPos.y.toFixed(1)}, {station.cameraPos.z.toFixed(1)}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleCaptureCamera(index)}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg px-2.5 py-1 text-[10px] font-semibold tracking-wide shrink-0 transition-colors"
                    title="Aktuellen 3D-Blickwinkel speichern"
                  >
                    Winkel holen
                  </button>
                </div>

                {/* Slider values specifically for Reveal portal state */}
                {station.viewMode === 'reveal' && (
                  <div className="grid grid-cols-2 gap-3 mt-1 p-2 bg-zinc-950/30 border border-zinc-850/30 rounded-xl">
                    <div className="flex flex-col gap-0.5 text-left">
                      <div className="flex justify-between text-[9px] text-zinc-500">
                        <span>Größe</span>
                        <span>{Math.round(station.revealRadius * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0.10" max="0.55" step="0.01" 
                        value={station.revealRadius} 
                        onChange={(e) => handleUpdateStationText(index, 'revealRadius', parseFloat(e.target.value))}
                        className="w-full accent-amber-500 h-1 bg-zinc-800 rounded"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 text-left">
                      <div className="flex justify-between text-[9px] text-zinc-500">
                        <span>Weichheit</span>
                        <span>{Math.round(station.revealSoftness * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0.01" max="0.18" step="0.01" 
                        value={station.revealSoftness} 
                        onChange={(e) => handleUpdateStationText(index, 'revealSoftness', parseFloat(e.target.value))}
                        className="w-full accent-amber-500 h-1 bg-zinc-800 rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add New Station */}
            <button 
              onClick={handleAddStation}
              className="w-full border border-dashed border-zinc-700 hover:border-amber-500/50 hover:bg-zinc-900/30 rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-all outline-none"
            >
              <Plus size={14} />
              <span>Neue Station hinzufügen</span>
            </button>
          </div>

          {/* Editor Footer Action Panel */}
          <div className="p-5 border-t border-white/10 shrink-0 bg-zinc-950 flex flex-col gap-3">
            <button
              onClick={handleRealign}
              className="w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl py-2.5 text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5 transition-all"
            >
              <RotateCcw size={14} />
              <span>Modelle mit 3 Punkten ausrichten</span>
            </button>

            <div className="flex gap-2">
              <button 
                onClick={handleRestoreDefaults}
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
                onClick={cancelEditor}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2.5 text-xs font-semibold transition-all"
              >
                Abbrechen
              </button>
              
              <button 
                onClick={saveAndExitEditor}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition-all"
              >
                <Save size={14} />
                <span>Speichern & Schließen</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

export default App;
