// Procedural Web Audio API Sound Engine (zero external asset failures)
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicPlaying = false;
    this.musicLowTime = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      this.ctx = new AudioCtx();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.muted ? 0 : 0.42;
      this.musicGain.connect(this.compressor);
    }
  }

  toggleMute() {
    this.init();
    this.muted = !this.muted;
    if (this.musicGain && this.ctx) {
      const target = this.muted ? 0 : this.musicPlaying ? 0.42 : 0.14;
      this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
    return this.muted;
  }

  startMusic() {
    this.init();
    if (!this.ctx || this.musicTimer) return;

    // Atmospheric sci-fi D-minor synth progression (bass + space arpeggio)
    const bassNotes = [73.42, 73.42, 58.27, 58.27, 65.41, 65.41, 55.0, 65.41]; // D2, Bb1, C2, A1
    const arpNotes = [
      293.66, 349.23, 440.0, 523.25,
      233.08, 293.66, 349.23, 440.0,
      261.63, 329.63, 392.0, 523.25,
      220.0, 277.18, 329.63, 440.0,
    ];

    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted) return;
      try {
        const now = this.ctx.currentTime;
        const step = this.musicStep % 16;
        const bassFreq = bassNotes[Math.floor(step / 2)];
        const arpFreq = arpNotes[step];

        // Warm pulsing synth bass every 2 steps
        if (step % 2 === 0) {
          const bOsc = this.ctx.createOscillator();
          const bFilt = this.ctx.createBiquadFilter();
          const bAmp = this.ctx.createGain();
          bOsc.type = 'sawtooth';
          bOsc.frequency.setValueAtTime(bassFreq, now);
          bFilt.type = 'lowpass';
          bFilt.frequency.setValueAtTime(this.musicLowTime ? 540 : 320, now);

          bAmp.gain.setValueAtTime(0.001, now);
          bAmp.gain.linearRampToValueAtTime(0.42, now + 0.04);
          bAmp.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

          bOsc.connect(bFilt);
          bFilt.connect(bAmp);
          bAmp.connect(this.musicGain);
          bOsc.start(now);
          bOsc.stop(now + 0.46);
        }

        // Cosmic floating arpeggio note
        const aOsc = this.ctx.createOscillator();
        const aAmp = this.ctx.createGain();
        aOsc.type = 'triangle';
        aOsc.frequency.setValueAtTime(arpFreq, now);
        aAmp.gain.setValueAtTime(0.001, now);
        aAmp.gain.linearRampToValueAtTime(this.musicLowTime ? 0.28 : 0.22, now + 0.03);
        aAmp.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

        aOsc.connect(aAmp);
        aAmp.connect(this.musicGain);
        aOsc.start(now);
        aOsc.stop(now + 0.36);

        // Soft ambient pad shimmer on bar starts
        if (step % 8 === 0) {
          const pOsc = this.ctx.createOscillator();
          const pAmp = this.ctx.createGain();
          pOsc.type = 'sine';
          pOsc.frequency.setValueAtTime(bassFreq * 2, now);
          pAmp.gain.setValueAtTime(0.001, now);
          pAmp.gain.linearRampToValueAtTime(0.22, now + 0.4);
          pAmp.gain.exponentialRampToValueAtTime(0.001, now + 1.85);
          pOsc.connect(pAmp);
          pAmp.connect(this.musicGain);
          pOsc.start(now);
          pOsc.stop(now + 1.9);
        }

        this.musicStep += 1;
      } catch {
        // Ignore audio scheduling errors
      }
    }, 250);
  }

  setMusicState(playing, lowTime = false) {
    this.musicPlaying = playing;
    this.musicLowTime = lowTime;
    if (!this.musicGain || !this.ctx) return;
    const target = this.muted ? 0 : playing ? 0.42 : 0.14;
    this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  _tone({ freq = 440, endFreq = null, type = 'sine', duration = 0.15, gain = 0.18, delay = 0 } = {}) {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      }
      amp.gain.setValueAtTime(0.001, now);
      amp.gain.linearRampToValueAtTime(Math.min(0.45, gain * 1.45), now + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(amp);
      amp.connect(this.compressor || this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Never break gameplay on audio errors
    }
  }

  playButton() {
    this.init();
    this._tone({ freq: 580, endFreq: 860, type: 'triangle', duration: 0.09, gain: 0.12 });
  }

  playKeypadDigit(digit) {
    this.init();
    const base = 460 + (Number(digit) || 0) * 42;
    this._tone({ freq: base, endFreq: base * 1.15, type: 'sine', duration: 0.07, gain: 0.12 });
  }

  playDecoyStatic() {
    this.init();
    this._tone({ freq: 260, endFreq: 110, type: 'sawtooth', duration: 0.14, gain: 0.1 });
    this._tone({ freq: 190, endFreq: 95, type: 'square', duration: 0.12, gain: 0.08, delay: 0.1 });
  }

  playTimeBonus() {
    this.init();
    this._tone({ freq: 660, endFreq: 990, type: 'sine', duration: 0.16, gain: 0.14 });
    this._tone({ freq: 990, endFreq: 1320, type: 'triangle', duration: 0.2, gain: 0.14, delay: 0.1 });
  }

  playTerminalActivate() {
    this.init();
    this._tone({ freq: 340, endFreq: 680, type: 'sine', duration: 0.12, gain: 0.14 });
    this._tone({ freq: 680, endFreq: 1020, type: 'triangle', duration: 0.14, gain: 0.12, delay: 0.08 });
  }

  playObjectiveComplete() {
    this.init();
    this._tone({ freq: 523.25, type: 'triangle', duration: 0.14, gain: 0.16, delay: 0 });
    this._tone({ freq: 659.25, type: 'triangle', duration: 0.14, gain: 0.16, delay: 0.1 });
    this._tone({ freq: 783.99, type: 'triangle', duration: 0.22, gain: 0.18, delay: 0.2 });
    this._tone({ freq: 1046.5, type: 'sine', duration: 0.3, gain: 0.14, delay: 0.3 });
  }

  playError() {
    this.init();
    this._tone({ freq: 220, endFreq: 140, type: 'sawtooth', duration: 0.18, gain: 0.12 });
  }

  playCountdownWarning() {
    this.init();
    this._tone({ freq: 880, endFreq: 720, type: 'square', duration: 0.07, gain: 0.07 });
  }

  playHeartbeat() {
    this.init();
    this._tone({ freq: 95, endFreq: 48, type: 'sine', duration: 0.12, gain: 0.22, delay: 0 });
    this._tone({ freq: 85, endFreq: 45, type: 'sine', duration: 0.14, gain: 0.16, delay: 0.15 });
  }

  playHazardImpact() {
    this.init();
    this._tone({ freq: 180, endFreq: 38, type: 'sawtooth', duration: 0.35, gain: 0.22 });
    this._tone({ freq: 420, endFreq: 90, type: 'square', duration: 0.25, gain: 0.14, delay: 0.03 });
  }

  playRewind() {
    this.init();
    this._tone({ freq: 920, endFreq: 180, type: 'sawtooth', duration: 0.45, gain: 0.14 });
    this._tone({ freq: 220, endFreq: 1100, type: 'sine', duration: 0.42, gain: 0.14, delay: 0.1 });
  }

  playRocketBoarding() {
    this.init();
    this._tone({ freq: 420, endFreq: 640, type: 'sine', duration: 0.16, gain: 0.14 });
    this._tone({ freq: 640, endFreq: 880, type: 'triangle', duration: 0.18, gain: 0.12, delay: 0.12 });
  }

  playClampRelease() {
    this.init();
    this._tone({ freq: 160, endFreq: 65, type: 'square', duration: 0.18, gain: 0.15 });
    this._tone({ freq: 520, endFreq: 260, type: 'sine', duration: 0.16, gain: 0.08, delay: 0.05 });
  }

  playBoosterSep() {
    this.init();
    this._tone({ freq: 240, endFreq: 80, type: 'triangle', duration: 0.22, gain: 0.14 });
    this._tone({ freq: 880, endFreq: 1320, type: 'sine', duration: 0.18, gain: 0.1, delay: 0.08 });
  }

  playEscapeLaunch() {
    this.init();
    // Realistic noise-filtered rocket engine roar!
    if (!this.muted && this.ctx) {
      try {
        const dur = 4.6;
        const sampleRate = this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * dur), sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.85;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const now = this.ctx.currentTime;
        filter.frequency.setValueAtTime(160, now);
        filter.frequency.exponentialRampToValueAtTime(980, now + 1.1);
        filter.frequency.exponentialRampToValueAtTime(320, now + dur);

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.linearRampToValueAtTime(0.24, now + 0.45);
        gainNode.gain.setValueAtTime(0.22, now + 2.4);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + dur + 0.05);
      } catch {
        // Ignore audio errors
      }
    }

    // Sub-bass thrust + celebratory arrival chord
    this._tone({ freq: 62, endFreq: 115, type: 'sawtooth', duration: 2.6, gain: 0.12 });
    this._tone({ freq: 523.25, type: 'triangle', duration: 0.35, gain: 0.14, delay: 4.1 });
    this._tone({ freq: 659.25, type: 'triangle', duration: 0.35, gain: 0.14, delay: 4.32 });
    this._tone({ freq: 783.99, type: 'triangle', duration: 0.4, gain: 0.15, delay: 4.54 });
    this._tone({ freq: 1046.5, type: 'sine', duration: 0.85, gain: 0.18, delay: 4.78 });
  }
}

export const sound = new SoundEngine();
