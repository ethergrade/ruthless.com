/**
 * T — Procedural audio engine (Web Audio API).
 * No external assets: every sound is synthesised at runtime so the game ships
 * with a full funk/hacker/light soundtrack + contextual SFX and zero binaries.
 *
 * BGM is a slow funk groove in A-minor pentatonic (bass slap + chord stabs +
 * offbeat hats + a "hacker" arpeggio through a delay). SFX are short enveloped
 * blips tuned to feel light, not abrasive.
 */
type SfxName =
  | 'click' | 'orderPlaced' | 'success' | 'failure'
  | 'trendSurge' | 'newsAlert' | 'endTurn' | 'build' | 'hireCeo' | 'exploit';

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
      this.musicGain.gain.value = this._musicEnabled ? this._musicVolume * 0.45 : 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._sfxEnabled ? this._sfxVolume : 0;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') {
      // resume() is async; once the context is running, (re)start BGM if it
      // was requested while suspended (e.g. on the very first user gesture).
      void this.ctx.resume().then(() => {
        if (this._musicEnabled) this.startBgm();
      });
    }
    return this.ctx;
  }

  // ---- settings (driven by Global Settings store) ------------------------
  setSfxEnabled(v: boolean): void {
    this._sfxEnabled = v;
    if (this.sfxGain) this.sfxGain.gain.value = v ? this._sfxVolume : 0;
  }
  setMusicEnabled(v: boolean): void {
    this._musicEnabled = v;
    if (this.musicGain) this.musicGain.gain.value = v ? this._musicVolume * 0.45 : 0;
    if (v) this.startBgm(); else this.stopBgm();
  }
  setSfxVolume(v: number): void {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && this._sfxEnabled) this.sfxGain.gain.value = this._sfxVolume;
  }
  setMusicVolume(v: number): void {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && this._musicEnabled) this.musicGain.gain.value = this._musicVolume * 0.45;
  }

  /** Resume the AudioContext after a user gesture (autoplay policy). */
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
        // glitchy hacker sweep
        this.blip({ freq: 1200, type: 'square', dur: 0.06, gain: 0.25, slideTo: 200 });
        this.noise(0.08, 0.12, 3000);
        setTimeout(() => this.blip({ freq: 900, type: 'square', dur: 0.06, gain: 0.25, slideTo: 300 }), 60);
        break;
    }
  }

  // ---- BGM: slow funk groove (A-minor pentatonic) -------------------------
  private readonly bass = [110, 0, 146.83, 0, 130.81, 0, 164.81, 0]; // A C E pattern
  private readonly chords = [
    [220, 261.63, 329.63], // Am
    [196, 246.94, 293.66], // G
    [174.61, 220, 261.63], // F
    [196, 246.94, 293.66], // G
  ];
  private readonly arp = [440, 523.25, 659.25, 880, 659.25, 523.25];

  startBgm(): void {
    const ctx = this.ensure();
    if (!ctx || this.bgmTimer !== null) return;
    // Browsers create the context suspended until a user gesture; if so, the
    // scheduler can't schedule against currentTime — bail and let unlock() retry.
    if (ctx.state === 'suspended') return;
    this.step = 0;
    this.nextNoteTime = ctx.currentTime + 0.1;
    const tempo = 100; // BPM — light, not frantic
    const stepDur = 60 / tempo / 2; // eighth notes
    const scheduler = () => {
      if (!this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
        this.scheduleStep(this.step, this.nextNoteTime);
        this.nextNoteTime += stepDur;
        this.step = (this.step + 1) % 16;
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
    // Bass slap on beats
    const b = this.bass[step % 8];
    if (b > 0) this.bassNote(b, time, dest);
    // Chord stab every 4 steps
    if (step % 4 === 0) {
      const chord = this.chords[(Math.floor(step / 4)) % this.chords.length];
      chord.forEach(f => this.stabNote(f, time, dest));
    }
    // Offbeat hat
    if (step % 2 === 1) this.hat(time, dest);
    // Hacker arpeggio every 2 steps (light, delayed)
    if (step % 2 === 0) {
      const f = this.arp[(step / 2) % this.arp.length];
      this.arpNote(f, time, dest);
    }
  }

  private bassNote(freq: number, time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 600;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.5, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(filt); filt.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + 0.24);
  }
  private stabNote(freq: number, time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1400;
    osc.type = 'triangle'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.18, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    osc.connect(filt); filt.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + 0.32);
  }
  private hat(time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(time); src.stop(time + 0.05);
  }
  private arpNote(freq: number, time: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const delay = ctx.createDelay(); delay.delayTime.value = 0.18;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    osc.type = 'triangle'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.1, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(g); g.connect(dest); g.connect(delay); delay.connect(fb); fb.connect(dest);
    osc.start(time); osc.stop(time + 0.2);
  }
}

export const audio = new AudioEngine();
