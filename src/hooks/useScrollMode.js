import { useEffect, useRef } from 'react';

export function useScrollMode(appState) {
  const lastStationAutoScrollRef = useRef(false);

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
      handleScroll();

      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    } else if (appState.stationMode === 'editor') {
      document.body.style.overflow = 'hidden';
    }
  }, [appState.mode, appState.stationMode]);

  // Auto-scroll to last station
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
    window.scrollTo({ top: maxScroll, behavior: 'smooth' });
  }, [
    appState.currentStationIndex,
    appState.mode,
    appState.scrollProgress,
    appState.stationMode,
    appState.stations.length
  ]);

  const scrollToStation = (index) => {
    if (appState.stationMode !== 'scroll') return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const intervalSize = 1.0 / (appState.stations.length - 1);
    const scrollTargetFraction = index * intervalSize;
    window.scrollTo({ top: scrollTargetFraction * maxScroll, behavior: 'smooth' });
  };

  return { scrollToStation };
}
