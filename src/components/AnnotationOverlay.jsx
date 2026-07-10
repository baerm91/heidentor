import React, { useEffect, useMemo, useState } from 'react';
import { Eye, MapPin, X } from 'lucide-react';

export function AnnotationOverlay({ activeStation, appState, isEditorMode, onDragAnnotation }) {
  const modelIsVisible = isEditorMode
    || (appState.mode === 'reveal' && !['idle', 'title'].includes(appState.introPhase || 'idle'));
  const annotations = useMemo(() => (
    !modelIsVisible || activeStation?.showAnnotations === false ? [] : (activeStation?.annotations || [])
  ), [activeStation, modelIsVisible]);
  const [positions, setPositions] = useState({});
  const [activeAnnotationId, setActiveAnnotationId] = useState(null);
  const [dragAnnotationId, setDragAnnotationId] = useState(null);
  const [dragScreenPosition, setDragScreenPosition] = useState(null);

  useEffect(() => {
    if (annotations.length === 0) {
      setPositions({});
      setActiveAnnotationId(null);
      return undefined;
    }

    let frameId = 0;
    const updatePositions = () => {
      const nextPositions = {};
      annotations.forEach((annotation) => {
        const projected = window.appState?.projectWorldPoint?.(annotation.position);
        if (projected?.visible) nextPositions[annotation.id] = projected;
      });
      setPositions(nextPositions);
      frameId = requestAnimationFrame(updatePositions);
    };

    updatePositions();
    return () => cancelAnimationFrame(frameId);
  }, [annotations]);

  useEffect(() => {
    if (!annotations.some((annotation) => annotation.id === activeAnnotationId)) {
      setActiveAnnotationId(null);
    }
  }, [annotations, activeAnnotationId]);

  useEffect(() => {
    const handlePlacedAnnotation = (event) => {
      const annotationId = event.detail?.annotationId;
      if (annotationId) setActiveAnnotationId(annotationId);
    };
    window.addEventListener('heidentor:annotation-placed', handlePlacedAnnotation);
    return () => window.removeEventListener('heidentor:annotation-placed', handlePlacedAnnotation);
  }, []);

  useEffect(() => {
    if (!dragAnnotationId) return undefined;

    const handlePointerMove = (event) => {
      setDragScreenPosition({ x: event.clientX, y: event.clientY });
      const placement = window.appState?.pickAnnotationPlacementAt?.(event.clientX, event.clientY);
      if (placement) onDragAnnotation?.(dragAnnotationId, placement);
    };

    const handlePointerUp = () => {
      setActiveAnnotationId(dragAnnotationId);
      setDragAnnotationId(null);
      setDragScreenPosition(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragAnnotationId, onDragAnnotation]);

  if (annotations.length === 0) return null;

  const activeAnnotation = annotations.find((annotation) => annotation.id === activeAnnotationId);
  const activeIndex = appState.stationMode === 'editor' ? null : appState.currentStationIndex;

  const focusAnnotationCamera = () => {
    if (!activeAnnotation || !activeStation) return;
    window.appState?.flyToStation?.({
      ...activeStation,
      cameraPos: activeAnnotation.cameraPos || activeStation.cameraPos,
      cameraTarget: activeAnnotation.cameraTarget || activeStation.cameraTarget
    }, activeIndex);
  };

  return (
    <div className="annotation-layer">
      {annotations.map((annotation) => {
        const projected = positions[annotation.id];
        const isDragging = dragAnnotationId === annotation.id;
        const visualPosition = projected || (isDragging ? dragScreenPosition : null);
        if (!visualPosition) return null;

        return (
          <button
            key={annotation.id}
            type="button"
            className={`annotation-marker ${activeAnnotationId === annotation.id ? 'is-active' : ''} ${isDragging ? 'is-dragging' : ''} ${isEditorMode ? 'is-editor-draggable' : ''}`}
            style={{ left: visualPosition.x, top: visualPosition.y }}
            onPointerDown={(event) => {
              if (!isEditorMode) return;
              event.preventDefault();
              event.stopPropagation();
              setActiveAnnotationId(annotation.id);
              setDragAnnotationId(annotation.id);
              setDragScreenPosition({ x: event.clientX, y: event.clientY });
            }}
            onClick={(event) => {
              if (dragAnnotationId) {
                event.preventDefault();
                return;
              }
              setActiveAnnotationId(annotation.id);
            }}
            title={isEditorMode ? 'Ziehen, um die Annotation im Raum zu verschieben' : (annotation.title || 'Annotation')}
          >
            <MapPin size={18} strokeWidth={1.8} />
          </button>
        );
      })}

      {activeAnnotation && (
        <div className="annotation-popover" role="dialog" aria-label={activeAnnotation.title || 'Annotation'}>
          <div className="annotation-popover-header">
            <div>
              <span className="annotation-kicker">{isEditorMode ? 'Editor-Annotation' : 'Fundpunkt'}</span>
              <h3>{activeAnnotation.title || 'Annotation'}</h3>
            </div>
            <button type="button" onClick={() => setActiveAnnotationId(null)} className="annotation-close" title="SchlieÃŸen">
              <X size={16} />
            </button>
          </div>

          {activeAnnotation.images?.length > 0 && (
            <div className={`annotation-images count-${Math.min(activeAnnotation.images.length, 4)}`}>
              {activeAnnotation.images.slice(0, 4).map((image, index) => (
                <img key={`${activeAnnotation.id}-image-${index}`} src={image} alt="" />
              ))}
            </div>
          )}

          {activeAnnotation.text && (
            <p className="annotation-text">{activeAnnotation.text}</p>
          )}

          {activeAnnotation.cameraPos && (
            <button type="button" className="annotation-focus-button" onClick={focusAnnotationCamera}>
              <Eye size={14} />
              <span>Blick öffnen</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
