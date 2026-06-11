import React from 'react';
import { createPortal } from 'react-dom';
import { Compass } from 'lucide-react';
import { parseTextWithHighlights } from '../utils/textFormatting.jsx';

export function NarrativeTextBlock({
  activeStation,
  activeIndex,
  appState,
  isIntroActive,
  introPhase,
  onDragStart
}) {
  if (!activeStation) return null;

  const isLastStation = appState.stationMode === 'scroll' && activeIndex === appState.stations.length - 1;
  const shouldFadeOut = isLastStation && appState.hasUserManipulatedCamera;
  const shouldWaitForIntroText = isIntroActive && introPhase !== 'text';
  const isEditorMode = appState.stationMode === 'editor';

  // Render behind the 3D model if configured and NOT in editor mode
  const renderBehind = !isEditorMode && activeStation.textLayer === 'behind';

  const textBlockElement = (
    <div 
      className={`fixed w-full max-w-lg pointer-events-none text-left transition-all duration-1000 ease-in-out station-text-panel ${
        shouldFadeOut || shouldWaitForIntroText ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}
      style={{
        left: `${activeStation.textX ?? 10}%`,
        top: `${activeStation.textY ?? 35}%`,
        zIndex: renderBehind ? 5 : 30
      }}
    >
      <div 
        key={`${activeStation.id}-${shouldWaitForIntroText ? 'hidden' : 'visible'}`}
        className={`animate-blur-fade-up flex flex-col gap-1 select-none relative ${
          shouldFadeOut ? 'pointer-events-none' : 'pointer-events-auto'
        } ${
          activeStation.milkyBg ? 'milky-glass-panel shadow-2xl' : ''
        } ${
          isEditorMode 
            ? `border border-dashed border-amber-500/50 p-6 rounded-2xl cursor-move ${activeStation.milkyBg ? '' : 'bg-zinc-950/45'}` 
            : ''
        }`}
        onMouseDown={(e) => {
          if (!isEditorMode) return;
          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
          e.preventDefault();
          onDragStart({
            type: 'text',
            startX: e.clientX,
            startY: e.clientY,
            startValueX: activeStation.textX ?? 10,
            startValueY: activeStation.textY ?? 35
          });
        }}
      >
        {isEditorMode && (
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
          {(activeStation.title || "").split('\\n').map((line, idx) => (
            <span key={idx} className="station-title-line block">
              {parseTextWithHighlights(line)}
            </span>
          ))}
        </h1>

        {/* Elegant Gold Divider */}
        <div className="flex items-center gap-4 my-5 w-full max-w-md">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9a96e]/60 to-[#c9a96e]/80"></div>
          <div className="w-2.5 h-2.5 rotate-45 border border-[#c9a96e] bg-[#0c0d12]/80 flex-shrink-0 shadow-[0_0_8px_rgba(201,169,110,0.5)]"></div>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#c9a96e]/60 to-[#c9a96e]/80"></div>
        </div>

        {/* Description */}
        <p className="station-description text-[#c8c3bc] font-serif text-xs sm:text-sm sm:leading-relaxed max-w-md font-light text-justify">
          {parseTextWithHighlights(activeStation.description, true)}
        </p>

        {/* Reveal mode notification indicator */}
        {activeStation.viewMode === 'portal' && (
          <div className="station-indicator-box mt-4 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[10px] leading-relaxed text-amber-400/90 flex gap-2 items-start max-w-md">
            <Compass size={12} className="mt-0.5 shrink-0 animate-pulse" />
            <span>Zeitportal komplett: Die Rekonstruktion ist voll sichtbar, der Übergang zum Reveal folgt in der nächsten Station.</span>
          </div>
        )}
        {activeStation.viewMode === 'reveal' && (
          <div className="station-indicator-box mt-4 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[10px] leading-relaxed text-amber-400/90 flex gap-2 items-start max-w-md">
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
                 <p className="station-sub-description text-[11px] leading-relaxed text-zinc-400 font-light">
                   {activeStation.subDescription.split('\\n').map((line, idx) => (
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
}
