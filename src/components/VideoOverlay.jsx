import React from 'react';

export function VideoOverlay({ activeStation, isEditorMode, onDragStart }) {
  if (!activeStation?.videoUrl) return null;

  return (
    <div
      className={`fixed z-30 transition-all duration-700 ease-in-out station-video-panel ${
        isEditorMode
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
        if (!isEditorMode) return;
        e.preventDefault();
        onDragStart({
          type: 'video',
          startX: e.clientX,
          startY: e.clientY,
          startValueX: activeStation.videoX ?? 58,
          startValueY: activeStation.videoY ?? 22
        });
      }}
    >
      {isEditorMode && (
        <div className="absolute -top-3 -left-3 bg-cyan-400 text-zinc-950 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded shadow-lg">
          Video ziehen
        </div>
      )}
      <iframe
        title={`Video ${activeStation.title || 'Station'}`}
        src={activeStation.videoUrl}
        className="w-full h-full rounded-xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-amber-500/30 hover:shadow-[0_0_30px_rgba(201,169,110,0.2)]"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
      {isEditorMode && (
        <div className="absolute inset-2 rounded-lg bg-transparent" />
      )}
    </div>
  );
}
