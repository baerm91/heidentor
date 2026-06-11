import * as THREE from 'three';

class AudioManager {
  constructor() {
    this.ctx = null;
    this.mainGain = null;
    this.windGain = null;
    this.padGain = null;
    this.isMuted = true; // Start muted by default to comply with browser autoplay policies
    this.isInitialized = false;

    // Synth elements
    this.oscillators = [];
    this.whiteNoise = null;
    this.lfos = [];
    
    // Bind interaction listeners to unlock AudioContext
    this._unlockAudio = this.unlockAudio.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this._unlockAudio, { capture: true, once: false });
      window.addEventListener('touchstart', this._unlockAudio, { capture: true, once: false });
    }
  }

  init() {
    if (this.isInitialized) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.ctx = new AudioContextClass();
      this.mainGain = this.ctx.createGain();
      
      // Main volume output
      this.mainGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
      this.mainGain.connect(this.ctx.destination);

      this.setupWindSoundscape();
      // this.setupSynthPad();

      this.isInitialized = true;
      console.log('✦ Audio engine initialized dynamically');
    } catch (e) {
      console.warn('AudioContext failed to start:', e);
    }
  }

  unlockAudio() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        // Remove listeners once audio context is running and active
        if (this.ctx.state === 'running') {
          window.removeEventListener('click', this._unlockAudio, { capture: true });
          window.removeEventListener('touchstart', this._unlockAudio, { capture: true });
        }
      });
    } else if (this.ctx && this.ctx.state === 'running') {
      window.removeEventListener('click', this._unlockAudio, { capture: true });
      window.removeEventListener('touchstart', this._unlockAudio, { capture: true });
    }
  }

  setupWindSoundscape() {
    if (!this.ctx) return;

    // 1. Create a 2-second looping white noise buffer
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = 2 * sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.whiteNoise = this.ctx.createBufferSource();
    this.whiteNoise.buffer = noiseBuffer;
    this.whiteNoise.loop = true;

    // 2. Set up bandpass filter for howling resonance
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 7.0; // Sharp resonance for realistic wind
    windFilter.frequency.value = 350;

    // 3. Modulate filter frequency with an LFO (Slow gust frequency oscillations)
    const lfoFilter = this.ctx.createOscillator();
    lfoFilter.type = 'sine';
    lfoFilter.frequency.value = 0.06; // 16s period

    const lfoFilterGain = this.ctx.createGain();
    lfoFilterGain.gain.value = 180; // Modulate frequency by +/- 180Hz

    lfoFilter.connect(lfoFilterGain);
    lfoFilterGain.connect(windFilter.frequency);
    lfoFilter.start();
    this.lfos.push(lfoFilter);

    // 4. Modulate wind volume with another LFO (Wind gusts)
    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.04, this.ctx.currentTime); // Low baseline volume

    const lfoVol = this.ctx.createOscillator();
    lfoVol.type = 'sine';
    lfoVol.frequency.value = 0.09; // 11s period

    const lfoVolGain = this.ctx.createGain();
    lfoVolGain.gain.value = 0.035; // Modulate gain by +/- 0.035

    lfoVol.connect(lfoVolGain);
    lfoVolGain.connect(this.windGain.gain);
    lfoVol.start();
    this.lfos.push(lfoVol);

    // Connect nodes
    this.whiteNoise.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.mainGain);
    
    this.whiteNoise.start(0);
  }

  setupSynthPad() {
    if (!this.ctx) return;

    // 1. Setup warm low-pass filter
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 200; // Deep, dark, cozy frequency
    padFilter.Q.value = 1.0;

    // Modulate pad cutoff slightly to keep it alive
    const lfoPadFilter = this.ctx.createOscillator();
    lfoPadFilter.frequency.value = 0.03; // Evolving every 33 seconds
    const lfoPadFilterGain = this.ctx.createGain();
    lfoPadFilterGain.gain.value = 60; // Modulate by +/- 60Hz

    lfoPadFilter.connect(lfoPadFilterGain);
    lfoPadFilterGain.connect(padFilter.frequency);
    lfoPadFilter.start();
    this.lfos.push(lfoPadFilter);

    // 2. Chord oscillators (C minor seventh chord: C3, G3, C4, Eb4, Bb4)
    const frequencies = [130.81, 196.00, 261.63, 311.13, 466.16];
    
    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.06, this.ctx.currentTime); // Soft background synth volume

    frequencies.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle'; // Warm, soft wave shape
      osc.frequency.value = freq + (Math.random() * 0.4 - 0.2); // Detuning for rich chorus effect
      
      osc.connect(padFilter);
      osc.start(0);
      this.oscillators.push(osc);
    });

    padFilter.connect(this.padGain);
    this.padGain.connect(this.mainGain);
  }

  playTransition() {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    if (this.ctx.state !== 'running') return;

    try {
      // Warm synth transition sweep
      const sweepOsc = this.ctx.createOscillator();
      const sweepFilter = this.ctx.createBiquadFilter();
      const sweepGain = this.ctx.createGain();

      sweepOsc.type = 'triangle';
      sweepOsc.frequency.setValueAtTime(110, this.ctx.currentTime);
      sweepOsc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 1.8);

      sweepFilter.type = 'lowpass';
      sweepFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
      sweepFilter.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 1.8);

      sweepGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      sweepGain.gain.linearRampToValueAtTime(0.035, this.ctx.currentTime + 0.4);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);

      sweepOsc.connect(sweepFilter);
      sweepFilter.connect(sweepGain);
      sweepGain.connect(this.mainGain);

      sweepOsc.start();
      sweepOsc.stop(this.ctx.currentTime + 1.8);
    } catch (e) {
      // Fail silently
    }
  }

  playClick() {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    if (this.ctx.state !== 'running') return;

    try {
      // Subtly high-frequency tactile marimba pluck
      const pluck = this.ctx.createOscillator();
      const pluckGain = this.ctx.createGain();

      pluck.type = 'sine';
      pluck.frequency.setValueAtTime(1200, this.ctx.currentTime);
      pluck.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.12);

      pluckGain.gain.setValueAtTime(0.015, this.ctx.currentTime);
      pluckGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      pluck.connect(pluckGain);
      pluckGain.connect(this.mainGain);

      pluck.start();
      pluck.stop(this.ctx.currentTime + 0.12);
    } catch (e) {
      // Fail silently
    }
  }

  setMute(mute) {
    this.isMuted = mute;
    
    // Unlock context if muted/unmuted on click
    if (!mute) {
      this.unlockAudio();
    }

    if (this.mainGain && this.ctx) {
      const targetGain = mute ? 0.0 : 0.8;
      this.mainGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.3);
    }
  }
}

// Export singleton instance
export const audioManager = new AudioManager();
if (typeof window !== 'undefined') {
  window.audioManager = audioManager;
}
