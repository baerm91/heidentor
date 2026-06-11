import React from 'react';
import { stripHighlights } from '../utils/textFormatting.jsx';

export function StationNavDots({ stations, currentStationIndex, onScrollToStation }) {
  return (
    <div className="fixed right-4 sm:right-6 md:right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-4 pointer-events-auto items-end select-none station-dots-nav bg-[#0a0b10]/40 border border-white/5 backdrop-blur-md px-3 py-6 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-white/10 hover:bg-[#0a0b10]/60">
      {stations.map((s, idx) => {
        const isActive = currentStationIndex === idx;
        return (
          <button
            key={s.id}
            onClick={() => {
              window.audioManager?.playClick();
              onScrollToStation(idx);
            }}
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
  );
}
