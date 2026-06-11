import React from 'react';
import { createPortal } from 'react-dom';

export function BackgroundLayer({ stations, activeIndex, showWatermark, useIntroWatermarkFade }) {
  const bgRoot = document.getElementById('bg-root');
  if (!bgRoot) return null;

  return createPortal(
    <>
      {/* Background images stack (placed behind the 3D model) */}
      <div className="fixed inset-0 pointer-events-none">
        {stations.map((s, idx) => {
          if (!s.bgImage) return null;
          const isActive = activeIndex === idx;
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
        {/* Vignette dark overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(1,1,1,0.85)_0%,rgba(1,1,1,0.98)_100%)]" />
      </div>

      {/* Giant background typography "HEIDENTOR" */}
      <div 
        className={`fixed inset-x-0 w-screen top-[13%] sm:top-[10%] md:top-[8%] text-center pointer-events-none select-none transition-all duration-1000 ease-out z-[2] overflow-visible ${
          showWatermark 
            ? 'opacity-100 scale-100' 
            : 'opacity-0 scale-95'
        } ${
          useIntroWatermarkFade ? 'intro-title-fade-in' : ''
        }`}
      >
        <span className="hero-watermark-title font-serif watermark-text-gradient uppercase leading-none block select-none whitespace-nowrap overflow-visible">
          HEIDENTOR
        </span>
      </div>

      {/* Subtle organic noise/stone texture overlay */}
      <div className="noise-overlay" />
    </>,
    bgRoot
  );
}
