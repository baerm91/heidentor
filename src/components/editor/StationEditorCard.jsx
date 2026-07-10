import React from 'react';
import { ArrowUp, ArrowDown, Trash2, Play, Sun, ChevronDown, ChevronUp, Image as ImageIcon, MapPin, MousePointer2, Plus } from 'lucide-react';
import { LightPositionControl } from './LightPositionControl.jsx';
import { ImageSlotEditor } from './ImageSlotEditor.jsx';
import { BACKGROUND_IMAGE_OPTIONS, LIGHT_SOURCES, LIGHT_POSITION_CONFIGS, PORTAL_PARAMS } from '../../constants.js';
import { stripHighlights } from '../../utils/textFormatting.jsx';

export function StationEditorCard({
  station,
  index,
  editingIndex,
  totalStations,
  activeAccordionIndex,
  activeImageAccordion,
  placingAnnotationId,
  onSetActiveAccordion,
  onSetActiveImageAccordion,
  onMoveStation,
  onDeleteStation,
  onTestStation,
  onCaptureCamera,
  onUpdateText,
  onUpdateLightPos,
  onToggleLightFixedToCamera,
  onUpdateImage,
  onUploadImage,
  onAddAnnotation,
  onDeleteAnnotation,
  onUpdateAnnotation,
  onCaptureAnnotation,
  onPlaceAnnotationInScene,
  onUploadAnnotationImages,
  onLocalBgUpload,
  getBgSelectValue
}) {
  return (
    <div 
      className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 relative transition-all hover:border-zinc-700"
    >
      {/* Station Badge and Actions */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
          Station #{index + 1}
        </span>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => onMoveStation(index, 'up')} 
            disabled={index === 0}
            className="p-1 rounded bg-zinc-950/50 hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none"
            title="Nach oben verschieben"
          >
            <ArrowUp size={12} />
          </button>
          <button 
            onClick={() => onMoveStation(index, 'down')} 
            disabled={index === totalStations - 1}
            className="p-1 rounded bg-zinc-950/50 hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none"
            title="Nach unten verschieben"
          >
            <ArrowDown size={12} />
          </button>
          <button 
            onClick={() => onDeleteStation(index)}
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
          onChange={(e) => onUpdateText(index, 'title', e.target.value)}
          className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none"
        />
      </div>

      {/* Description Textarea */}
      <div className="flex flex-col gap-1 text-left">
        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Beschreibung</label>
        <textarea 
          rows="3"
          value={station.description}
          onChange={(e) => onUpdateText(index, 'description', e.target.value)}
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
            onChange={(e) => onUpdateText(index, 'textX', parseInt(e.target.value))}
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
            onChange={(e) => onUpdateText(index, 'textY', parseInt(e.target.value))}
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
            onChange={(e) => onUpdateText(index, 'textLayer', e.target.value)}
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
              onChange={(e) => onUpdateText(index, 'milkyBg', e.target.checked)}
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
              onUpdateText(index, 'bgImage', 'data:image/placeholder;base64,');
            } else if (val === 'custom') {
              onUpdateText(index, 'bgImage', 'custom_image_url.png');
            } else {
              onUpdateText(index, 'bgImage', val);
            }
          }}
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
        >
          {BACKGROUND_IMAGE_OPTIONS.map((option) => (
            <option key={option.value || 'default'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {getBgSelectValue(station.bgImage) === 'upload' && (
          <div className="mt-1 flex flex-col gap-1">
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => onLocalBgUpload(index, e)}
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
            onChange={(e) => onUpdateText(index, 'bgImage', e.target.value)}
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
            onChange={(e) => onUpdateText(index, 'subTitle', e.target.value)}
            className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Detailtext (unten)</label>
          <textarea 
            rows="2"
            placeholder="z.B. Zeuge einer Ära..."
            value={station.subDescription ?? ''}
            onChange={(e) => onUpdateText(index, 'subDescription', e.target.value)}
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
          onChange={(e) => onUpdateText(index, 'videoUrl', e.target.value)}
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
              onChange={(e) => onUpdateText(index, 'videoX', parseInt(e.target.value))}
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
              onChange={(e) => onUpdateText(index, 'videoY', parseInt(e.target.value))}
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
              onChange={(e) => onUpdateText(index, 'videoWidth', parseInt(e.target.value))}
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
              onChange={(e) => onUpdateText(index, 'videoHeight', parseInt(e.target.value))}
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
            onChange={(e) => onUpdateText(index, 'viewMode', e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="ruin">Gegenwart (Ruine)</option>
            <option value="recon">Rekonstruktion</option>
            <option value="portal">Zeitportal (komplett)</option>
            <option value="reveal">Zeitportal (Reveal)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 justify-end">
          <button 
            onClick={() => onTestStation(index, station)}
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
          onClick={() => onCaptureCamera(index)}
          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg px-2.5 py-1 text-[10px] font-semibold tracking-wide shrink-0 transition-colors"
          title="Aktuellen 3D-Blickwinkel speichern"
        >
          Winkel holen
        </button>
      </div>

      {/* Free navigation */}
      <label className="flex items-center gap-2 px-3 py-2 bg-zinc-950/45 border border-zinc-850 rounded-xl text-xs cursor-pointer hover:border-amber-500/25 select-none">
        <input
          type="checkbox"
          checked={!!station.freeNavigation}
          onChange={(e) => onUpdateText(index, 'freeNavigation', e.target.checked)}
          className="accent-amber-500 rounded border-zinc-700 bg-zinc-900"
        />
        <MousePointer2 size={13} className="text-amber-400" />
        <span className="text-zinc-300">Freie Navigation an dieser Station erlauben</span>
      </label>

      {/* Licht & Schatten Accordion Section */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden mt-1 bg-zinc-950/30">
        <button
          type="button"
          onClick={() => onSetActiveAccordion(activeAccordionIndex === 'lightShadow' ? null : 'lightShadow')}
          className="w-full flex justify-between items-center px-3 py-2 text-left bg-zinc-950/50 hover:bg-zinc-900/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-zinc-300">
            <Sun size={12} className="text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Licht & Schatten</span>
          </div>
          {activeAccordionIndex === 'lightShadow' ? <ChevronUp size={14} className="text-zinc-550" /> : <ChevronDown size={14} className="text-zinc-550" />}
        </button>
        
        {activeAccordionIndex === 'lightShadow' && (
          <div className="p-3 flex flex-col gap-3 border-t border-zinc-850 bg-zinc-950/10 animate-blur-fade-up">
            <div className="flex flex-col gap-1 text-left">
              <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                <span>Lichtintensität</span>
                <span className="text-amber-400 font-mono">{(station.lightIntensity ?? 1.0).toFixed(1)}x</span>
              </div>
              <input
                type="range" min="0.0" max="4.0" step="0.1"
                value={station.lightIntensity ?? 1.0}
                onChange={(e) => onUpdateText(index, 'lightIntensity', parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-zinc-800 rounded cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1 text-left">
              <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                <span>Schattendiffusität (Radius)</span>
                <span className="text-amber-400 font-mono">{(station.shadowDiffuse ?? 1.0).toFixed(1)}</span>
              </div>
              <input
                type="range" min="0.0" max="10.0" step="0.5"
                value={station.shadowDiffuse ?? 1.0}
                onChange={(e) => onUpdateText(index, 'shadowDiffuse', parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-zinc-800 rounded cursor-pointer"
              />
            </div>

            {/* Grid of active lights */}
            <div className="flex flex-col gap-1.5 text-left border-t border-zinc-850/60 pt-2">
              <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-550 block mb-1">
                Aktive Lichtquellen
              </span>
              <div className="grid grid-cols-2 gap-2">
                {LIGHT_SOURCES.map(({ key, label, desc }) => (
                  <label key={key} className="flex flex-col justify-center gap-0.5 p-2 bg-zinc-950/40 border border-zinc-850/60 rounded-xl hover:border-amber-500/20 cursor-pointer select-none transition-all">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={station[key] ?? true}
                        onChange={(e) => onUpdateText(index, key, e.target.checked)}
                        className="accent-amber-500 rounded border-zinc-700 bg-zinc-900"
                      />
                      <span className="text-[11px] text-zinc-200 font-medium">{label}</span>
                    </div>
                    <span className="text-[8px] text-zinc-500 pl-5 leading-none">{desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Position sliders for Key, Fill, Spot Lights */}
            {LIGHT_POSITION_CONFIGS.map((config) => {
              if (!(station[config.enabledKey] ?? true)) return null;
              return (
                <LightPositionControl
                  key={config.posKey}
                  station={station}
                  stationIndex={index}
                  config={config}
                  onUpdateLightPos={onUpdateLightPos}
                  onToggleFixedToCamera={onToggleLightFixedToCamera}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 3D Bildquellen Accordion Section */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden mt-1 bg-zinc-950/30">
        <button
          type="button"
          onClick={() => onSetActiveAccordion(activeAccordionIndex === 'images' ? null : 'images')}
          className="w-full flex justify-between items-center px-3 py-2 text-left bg-zinc-950/50 hover:bg-zinc-900/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-zinc-300">
            <ImageIcon size={12} className="text-cyan-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Bildquellen in 3D (Max. 3)</span>
          </div>
          {activeAccordionIndex === 'images' ? <ChevronUp size={14} className="text-zinc-550" /> : <ChevronDown size={14} className="text-zinc-550" />}
        </button>

        {activeAccordionIndex === 'images' && (
          <div className="p-2 flex flex-col gap-2 border-t border-zinc-850 bg-zinc-950/10 animate-blur-fade-up">
            {[0, 1, 2].map((imgIdx) => {
              const img = (station.images && station.images[imgIdx]) || { url: "", posX: 0, posY: 3.5, posZ: 0, scale: 1.0, fixToCamera: false };
              return (
                <ImageSlotEditor
                  key={imgIdx}
                  img={img}
                  imgIndex={imgIdx}
                  stationIndex={index}
                  isActive={activeImageAccordion === imgIdx}
                  onToggle={onSetActiveImageAccordion}
                  onUpdateImage={onUpdateImage}
                  onUploadImage={onUploadImage}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Annotationen Accordion Section */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden mt-1 bg-zinc-950/30">
        <button
          type="button"
          onClick={() => onSetActiveAccordion(activeAccordionIndex === 'annotations' ? null : 'annotations')}
          className="w-full flex justify-between items-center px-3 py-2 text-left bg-zinc-950/50 hover:bg-zinc-900/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-zinc-300">
            <MapPin size={12} className="text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Annotationen</span>
            <span className="text-[9px] text-zinc-500">({station.annotations?.length ?? 0})</span>
          </div>
          {activeAccordionIndex === 'annotations' ? <ChevronUp size={14} className="text-zinc-550" /> : <ChevronDown size={14} className="text-zinc-550" />}
        </button>

        {activeAccordionIndex === 'annotations' && (
          <div className="p-3 flex flex-col gap-3 border-t border-zinc-850 bg-zinc-950/10 animate-blur-fade-up">
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!station.showAnnotations}
                onChange={(e) => onUpdateText(index, 'showAnnotations', e.target.checked)}
                className="accent-amber-500 rounded border-zinc-700 bg-zinc-900"
              />
              <span>Annotationen in dieser Station anzeigen</span>
            </label>

            {(station.annotations || []).map((annotation, annotationIndex) => (
              <div key={annotation.id} className="rounded-xl border border-zinc-800 bg-zinc-950/45 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Punkt {annotationIndex + 1}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onCaptureAnnotation(index, annotation.id)}
                      className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 hover:bg-amber-500/20"
                      title="Aktuellen Blick und Markerposition speichern"
                    >
                      Setzen
                    </button>
                    <button
                      type="button"
                      onClick={() => onPlaceAnnotationInScene(index, annotation.id)}
                      className={`px-2 py-1 rounded-lg border text-[10px] transition-colors ${
                        placingAnnotationId === annotation.id
                          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                          : 'bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-200'
                      }`}
                      title="NÃ¤chsten Klick im 3D-Raum als Annotation-Position speichern"
                    >
                      {placingAnnotationId === annotation.id ? 'Klick im Raum...' : 'Im Raum platzieren'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAnnotation(index, annotation.id)}
                      className="p-1 rounded bg-red-950/30 hover:bg-red-900/40 text-red-400"
                      title="Annotation lÃ¶schen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Titel"
                  value={annotation.title ?? ''}
                  onChange={(e) => onUpdateAnnotation(index, annotation.id, 'title', e.target.value)}
                  className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
                />
                <textarea
                  rows="3"
                  placeholder="Text"
                  value={annotation.text ?? ''}
                  onChange={(e) => onUpdateAnnotation(index, annotation.id, 'text', e.target.value)}
                  className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    onUploadAnnotationImages(index, annotation.id, e);
                    e.target.value = '';
                  }}
                  className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-amber-500/50"
                />
                {annotation.images?.length > 0 && (
                  <span className="text-[9px] text-emerald-400">{annotation.images.length} Bild(er) hinterlegt</span>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {['x', 'y', 'z'].map((axis) => (
                    <label key={axis} className="flex flex-col gap-1">
                      <span className="text-[8px] uppercase tracking-wider text-zinc-550">{axis.toUpperCase()}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={Number(annotation.position?.[axis] ?? 0).toFixed(1)}
                        onChange={(e) => {
                          const nextPosition = {
                            x: annotation.position?.x ?? 0,
                            y: annotation.position?.y ?? 3.5,
                            z: annotation.position?.z ?? 0,
                            [axis]: parseFloat(e.target.value) || 0
                          };
                          onUpdateAnnotation(index, annotation.id, 'position', nextPosition);
                        }}
                        className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-amber-500/50"
                      />
                    </label>
                  ))}
                </div>
                <span className="text-[9px] font-mono text-zinc-500">
                  Pos: {(annotation.position?.x ?? 0).toFixed(1)}, {(annotation.position?.y ?? 0).toFixed(1)}, {(annotation.position?.z ?? 0).toFixed(1)}
                </span>
              </div>
            ))}

            <button
              type="button"
              onClick={() => onAddAnnotation(index)}
              className="w-full border border-dashed border-zinc-700 hover:border-amber-500/50 rounded-xl py-2 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-all"
            >
              <Plus size={13} />
              <span>Annotation hinzufÃ¼gen</span>
            </button>
          </div>
        )}
      </div>

      {/* Slider values specifically for portal states */}
      {(station.viewMode === 'portal' || station.viewMode === 'reveal') && (
        <div className="grid grid-cols-2 gap-3 mt-1 p-2 bg-zinc-950/30 border border-zinc-850/30 rounded-xl">
          <div className="flex flex-col gap-0.5 text-left">
            <div className="flex justify-between text-[9px] text-zinc-500">
              <span>Größe</span>
              <span>{Math.round(station.revealRadius * 100)}%</span>
            </div>
            <input 
              type="range" min="0.10" max={station.viewMode === 'portal' ? '3.50' : '0.55'} step="0.01" 
              value={station.revealRadius} 
              onChange={(e) => onUpdateText(index, 'revealRadius', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-800 rounded"
            />
          </div>
          <div className="flex flex-col gap-0.5 text-left">
            <div className="flex justify-between text-[9px] text-zinc-550">
              <span>Weichheit</span>
              <span>{Math.round(station.revealSoftness * 100)}%</span>
            </div>
            <input 
              type="range" min="0.01" max="0.18" step="0.01" 
              value={station.revealSoftness} 
              onChange={(e) => onUpdateText(index, 'revealSoftness', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-800 rounded"
            />
          </div>
        </div>
      )}
      {(station.viewMode === 'portal' || station.viewMode === 'reveal') && (
        <div className="grid grid-cols-2 gap-3 mt-1 p-2 bg-zinc-950/30 border border-amber-500/10 rounded-xl">
          {PORTAL_PARAMS.map(([field, label, min, max, step, fallback]) => (
            <div key={field} className="flex flex-col gap-0.5 text-left">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>{label}</span>
                <span>{Number(station[field] ?? fallback).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={station[field] ?? fallback}
                onChange={(e) => onUpdateText(index, field, parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-zinc-800 rounded"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
