/**
 * Procedural audio engine (Web Audio API).
 * No external assets: every sound is synthesised at runtime so the game ships
 * with a full soundtrack + contextual SFX and zero binaries.
 *
 * BGM is a 128-step (8-bar × 16-step) evolving sequencer in A-minor: a funk
 * bassline, chord stabs, offbeat hats, a delayed "hacker" arpeggio and a
 * wandering lead. Patterns vary bar-to-bar so the loop never feels static.
 *
 * IMPORTANT (autoplay / mute correctness): BGM is started ONLY by an explicit
 * setMusicEnabled(true) call. Generic gestures / SFX go through ensure() which
 * only (re)creates + resumes the AudioContext — it must NEVER auto-start BGM,
 * otherwise muting would be undone by the next click.
 */

type SfxName =
  | 'click' | 'orderPlaced' | 'success' | 'failure'
  | 'trendSurge' | 'newsAlert' | 'endTurn' | 'build' | 'hireCeo' | 'exploit';

// A natural-minor-ish scale (Hz) used for the lead/arp, rooted on A2.
const SCALE = [110, 123.47, 130.81, 146.83, 164.81, 174.61, 196, 220];
// 8-bar chord roots (Am – F – C – G – Am – F – G – E) for a light funk loop.
const BAR_ROOTS = [110, 87.31, 130.81, 98, 110, 87.31, 98, 82.41];
const BAR_CHORD = [
  [220, 261.63, 329.63], // Am
  [174.61, 220, 261.63], // F
  [261.63, 329.63, 392], // C
  [196, 246.94, 293.66], // G
  [220, 261.63, 329.63], // Am
  [174.61, 220, 261.63], // F
  [196, 246.94, 293.66], // G
  [164.81, 207.65, 246.94], // E
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private _sfxEnabled = true;
  private _musicEnabled = false;
  private _sfxVolume = 0.5;
  private _musicVolume = 0.5;
  private bgmTimer: number | null = null;
  private step = 0;
  private nextNoteTime = 0;
  // Per-bar variation seed so the lead/arp evolve without random chaos.
  private barSeed = 0;

  /** Lazily create the context (must follow a user gesture). */
  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._musicEnabled ? this._musicVolume * 0.4 : 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._sfxEnabled ? this._sfxVolume : 0;
      this.sfxGain.connect(this.master);
    }
    // Resume if suspended (autoplay policy). NOTE: this must NOT start BGM —
    // only setMusicEnabled(true) does that (see the mute bug fix below).
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  // ---- settings (driven by Global Settings store) ------------------------
  setSfxEnabled(v: boolean): void {
    this._sfxEnabled = v;
    if (this.sfxGain) this.sfxGain.gain.value = v ? this._sfxVolume : 0;
  }
  setMusicEnabled(v: boolean): void {
    this._musicEnabled = v;
    if (this.musicGain) this.musicGain.gain.value = v ? this._musicVolume * 0.4 : 0;
    if (v) {
      const ctx = this.ensure();
      // If the context is still suspended (pre-gesture), resume() is async;
      // start once it is actually running.
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume().then(() => this.startBgm());
      } else {
        this.startBgm();
      }
    } else {
      this.stopBgm();
    }
  }
  setSfxVolume(v: number): void {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && this._sfxEnabled) this.sfxGain.gain.value = this._sfxVolume;
  }
  setMusicVolume(v: number): void {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && this._musicEnabled) this.musicGain.gain.value = this._musicVolume * 0.4;
  }

  /** Resume the AudioContext after a user gesture (autoplay policy). Does NOT start BGM. */
  unlock(): void { this.ensure(); }

  // ---- low-level voice ----------------------------------------------------
  private blip(opts: {
    freq: number; type?: OscillatorType; dur?: number; gain?: number;
    attack?: number; decay?: number; slideTo?: number; dest?: AudioNode;
  }): void {
    const ctx = this.ensure();
    if (!ctx || !this.ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t + (opts.dur ?? 0.15));
    const dur = opts.dur ?? 0.15;
    const peak = opts.gain ?? 0.5;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(opts.dest ?? this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, hp = 2000): void {
    const ctx = this.ensure();
    if (!ctx || !this.ctx) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain!);
    src.start(t); src.stop(t + dur);
  }

  // ---- contextual SFX -----------------------------------------------------
  sfx(name: SfxName): void {
    if (!this._sfxEnabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    switch (name) {
      case 'click': this.blip({ freq: 880, type: 'square', dur: 0.05, gain: 0.25 }); break;
      case 'orderPlaced':
        this.blip({ freq: 523, type: 'triangle', dur: 0.12, gain: 0.4 });
        this.blip({ freq: 784, type: 'triangle', dur: 0.14, gain: 0.35, slideTo: 1046 });
        break;
      case 'success':
        [523, 659, 784, 1046].forEach((f, i) =>
          setTimeout(() => this.blip({ freq: f, type: 'triangle', dur: 0.18, gain: 0.4 }), i * 60));
        break;
      case 'failure':
        this.blip({ freq: 320, type: 'sawtooth', dur: 0.3, gain: 0.35, slideTo: 120 });
        this.noise(0.2, 0.15, 800);
        break;
      case 'trendSurge':
        this.blip({ freq: 300, type: 'sine', dur: 0.4, gain: 0.3, slideTo: 1200 });
        break;
      case 'newsAlert':
        this.blip({ freq: 1320, type: 'sine', dur: 0.1, gain: 0.3 });
        setTimeout(() => this.blip({ freq: 1320, type: 'sine', dur: 0.1, gain: 0.3 }), 140);
        break;
      case 'endTurn':
        this.blip({ freq: 196, type: 'sine', dur: 0.25, gain: 0.45, slideTo: 98 });
        break;
      case 'build':
        this.blip({ freq: 440, type: 'square', dur: 0.08, gain: 0.3 });
        setTimeout(() => this.blip({ freq: 660, type: 'square', dur: 0.1, gain: 0.3 }), 70);
        break;
      case 'hireCeo':
        [392, 523, 659].forEach((f, i) =>
          setTimeout(() => this.blip({ freq: f, type: 'triangle', dur: 0.2, gain: 0.4 }), i * 80));
        break;
      case 'exploit':
        this.blip({ freq: 1200, type: 'square', dur: 0.06, gain: 0.25, slideTo: 200 });
        this.noise(0.08, 0.12, 3000);
        setTimeout(() => this.blip({ freq: 900, type: 'square', dur: 0.06, gain: 0.25, slideTo: 300 }), 60);
        break;
    }
  }

  // ---- BGM: 128-step evolving sequencer (8 bars × 16 steps) ----------------
  private readonly STEPS = 128;
  private readonly tempo = 96; // BPM — light, not frantic

  startBgm(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    // Guard: never start unless explicitly enabled, and never double-start.
    if (!this._musicEnabled || this.bgmTimer !== null) return;
    if (ctx.state === 'suspended') return; // wait for resume to call us again
    this.step = 0;
    this.barSeed = 0;
    this.nextNoteTime = ctx.currentTime + 0.1;
    const stepDur = 60 / this.tempo / 4; // 16th notes
    const scheduler = () => {
      if (!this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
        this.scheduleStep(this.step, this.nextNoteTime);
        this.nextNoteTime += stepDur;
        this.step = (this.step + 1) % this.STEPS;
        if (this.step % 16 === 0) this.barSeed = (this.barSeed + 1) % 8; // evolve per bar
      }
    };
    this.bgmTimer = window.setInterval(scheduler, 25);
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const dest = this.musicGain;
    const bar = Math.floor(step / 16) % 8;
    const s = step % 16;
    const root = BAR_ROOTS[bar];
    const chord = BAR_CHORD[bar];

    // --- Bass: funk octave-hop pattern, varies each bar ---
    const bassPattern = [0, -1, 6, -1, 3, -1, 8, -1, 0, -1, 6, -1, 10, -1, 3, -1];
    if (bassPattern[s] >= 0) {
      this.bassNote(root * Math.pow(2, bassPattern[s] / 12), time, dest);
    }

    // --- Chord stabs on the bar + the "and" of 2 and 4 ---
    if (s === 0 || s === 6 || s === 10) {
      chord.forEach(f => this.stabNote(f, time, dest));
    }

    // --- Drums: kick / snare / hats (hats every offbeat for the funk feel) ---
    if (s === 0 || s === 8) this.kick(time, dest);
    if (s === 4 || s === 12) this.snare(time, dest);
    if (s % 2 === 1) this.hat(time, dest, bar === 7); // brighter hat on the fill bar

    // --- Hacker arpeggio (delayed triangle) on every other 16th ---
    if (s % 2 === 0) {
      const arpScale = [root * 4, root * 4 * 1.2, root * 4 * 1.5, root * 8];
      const idx = ((step / 2) + this.barSeed) % arpScale.length;
      this.arpNote(arpScale[Math.floor(idx)], time, dest);
    }

    // --- Wandering lead: a short motif that drifts each bar (variation) ---
    if (s === 2 || s === 7 || s === 11 || s === 14) {
      const note = SCALE[(this.barSeed + s) % SCALE.length] * 2;
      this.leadNote(note, time, dest);
    }
  }

  private bassNote(freq: number, time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 500;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.45, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(filt); filt.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + 0.22);
  }
  private stabNote(freq: number, time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1300;
    osc.type = 'triangle'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.14, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
    osc.connect(filt); filt.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + 0.3);
  }
  private hat(time: number, dest: AudioNode, bright: boolean): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = bright ? 9000 : 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(bright ? 0.1 : 0.07, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(time); src.stop(time + 0.05);
  }
  private kick(time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(0.5, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    osc.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + 0.18);
  }
  private snare(time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(time); src.stop(time + 0.12);
  }
  private arpNote(freq: number, time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const delay = ctx.createDelay(); delay.delayTime.value = 0.18;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    osc.type = 'triangle'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.08, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    osc.connect(g); g.connect(dest); g.connect(delay); delay.connect(fb); fb.connect(dest);
    osc.start(time); osc.stop(time + 0.18);
  }
  private leadNote(freq: number, time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2200;
    osc.type = 'square'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.06, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(filt); filt.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + 0.24);
  }
}

export const audio = new AudioEngine();
