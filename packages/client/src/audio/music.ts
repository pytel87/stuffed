// Background music: a music-box tune on the menu and a bouncier one in matches, each map with its
// own. Played from public/music/<mood>_<map theme>.mp3 or <mood>.mp3 when there's one (see
// tools/music.json; looped without a seam), otherwise made right here
// with Web Audio: a little toy band (bells, a plucked bass, a soft shaker) playing a looping
// chord progression. Quiet under the sound effects; it has its own on/off in the options.
import { seamless, type Sound } from './sound.ts';

export type Mood = 'menu' | 'match' | 'off';

const KEY = 'stuffed.music';
const VOLUME = 0.2;

/** C major, as frequencies: note n semitones above middle C. */
const note = (n: number) => 261.63 * 2 ** (n / 12);

interface Tune {
  bpm: number;
  /** Chords (semitones from C) for each bar. */
  chords: number[][];
  /** The melody, one entry per eighth note: semitones from C, or null for a rest. */
  melody: (number | null)[];
  /** Bass and shaker on? */
  band: boolean;
}

const TUNES: Record<Exclude<Mood, 'off'>, Tune> = {
  menu: {
    bpm: 84,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    melody: [12, null, 16, 19, 16, null, 14, null, 9, null, 12, 16, 12, null, 11, null, 9, null, 12, 14, 12, null, 7, null, 11, null, 14, 17, 14, 12, 11, null],
    band: false,
  },
  match: {
    bpm: 120,
    chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [-5, -1, 2]],
    melody: [12, 12, 16, null, 19, 16, 14, null, 17, 17, 21, null, 19, 17, 16, 14, 16, 12, 9, null, 12, 16, 14, 12, 11, null, 14, 11, 7, null, 11, 14],
    band: true,
  },
};

export class Music {
  private mood: Mood = 'off';
  /** The map's theme, for its own track. */
  private variant = '';
  private enabled = true;
  private gain: GainNode | null = null;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private file: AudioBufferSourceNode | null = null;
  private readonly files = new Map<string, AudioBuffer | null>();

  constructor(
    private readonly sound: Sound,
    private readonly baseUrl: string,
  ) {
    try {
      this.enabled = localStorage.getItem(KEY) !== '0';
    } catch {
      // storage blocked: on
    }
    sound.onStart = () => this.restart();
  }

  get isOn(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(KEY, this.enabled ? '1' : '0');
    } catch {
      // not remembered; fine
    }
    this.restart();
    return this.enabled;
  }

  /** Which tune to play now, and for which map (the same one keeps playing). */
  play(mood: Mood, variant = ''): void {
    if (mood === this.mood && variant === this.variant) return;
    this.mood = mood;
    this.variant = variant;
    this.restart();
  }

  private stop(): void {
    clearInterval(this.timer);
    this.timer = 0;
    const out = this.sound.output;
    if (this.gain && out) {
      const g = this.gain;
      g.gain.setTargetAtTime(0, out.ctx.currentTime, 0.25);
      setTimeout(() => g.disconnect(), 1500);
    }
    this.gain = null;
    this.file?.stop(out ? out.ctx.currentTime + 1 : 0);
    this.file = null;
  }

  private restart(): void {
    this.stop();
    const out = this.sound.output;
    if (!out || !this.enabled || this.mood === 'off') return;
    this.gain = out.ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.gain.setTargetAtTime(VOLUME, out.ctx.currentTime, 0.6);
    this.gain.connect(out.master);
    const mood = this.mood;
    const variant = this.variant;
    void this.loadTrack(mood, variant).then((buffer) => {
      if (this.mood !== mood || this.variant !== variant || !this.gain) return;
      if (buffer) {
        const src = out.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(this.gain);
        src.start();
        this.file = src;
      } else {
        this.step = 0;
        this.nextTime = out.ctx.currentTime + 0.1;
        this.timer = window.setInterval(() => this.schedule(TUNES[mood]), 50);
      }
    });
  }

  /** The map's own track, else the mood's (null: play the built-in tune). */
  private async loadTrack(mood: Exclude<Mood, 'off'>, variant: string): Promise<AudioBuffer | null> {
    return (variant ? await this.loadFile(`${mood}_${variant}`) : null) ?? this.loadFile(mood);
  }

  /** The generated track for this mood, if there is one. */
  private async loadFile(mood: string): Promise<AudioBuffer | null> {
    if (this.files.has(mood)) return this.files.get(mood)!;
    let buffer: AudioBuffer | null = null;
    try {
      const res = await fetch(`${this.baseUrl}music/${mood}.mp3`);
      const type = res.headers.get('content-type') ?? '';
      const ctx = this.sound.output!.ctx;
      if (res.ok && type.includes('audio')) buffer = seamless(ctx, await ctx.decodeAudioData(await res.arrayBuffer()));
    } catch {
      // none: play the built-in tune
    }
    this.files.set(mood, buffer);
    return buffer;
  }

  /** Schedules the notes falling in the next fraction of a second. */
  private schedule(tune: Tune): void {
    const out = this.sound.output;
    if (!out || !this.gain) return;
    const eighth = 60 / tune.bpm / 2;
    while (this.nextTime < out.ctx.currentTime + 0.25) {
      const i = this.step % tune.melody.length;
      const bar = Math.floor(this.step / 8) % tune.chords.length;
      const chord = tune.chords[bar]!;
      const m = tune.melody[i];
      if (m !== null && m !== undefined) this.bell(out.ctx, note(m), this.nextTime, eighth * 1.8, 0.5);
      // Soft chord tones on each beat.
      if (this.step % 2 === 0) this.bell(out.ctx, note(chord[(this.step / 2) % chord.length]!), this.nextTime, eighth * 2.5, 0.22);
      if (tune.band) {
        if (this.step % 4 === 0) this.pluck(out.ctx, note(chord[0]! - 24), this.nextTime, eighth * 2);
        if (this.step % 2 === 1) this.shaker(out.ctx, this.nextTime);
      }
      this.nextTime += eighth;
      this.step++;
    }
  }

  /** A music-box bell: a sine and a quiet octave, ringing out. */
  private bell(ctx: AudioContext, freq: number, at: number, length: number, level: number): void {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level * 0.3, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, at + length);
    g.connect(this.gain!);
    for (const [mult, type, vol] of [[1, 'sine', 1], [2, 'triangle', 0.25]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * mult;
      const v = ctx.createGain();
      v.gain.value = vol;
      o.connect(v).connect(g);
      o.start(at);
      o.stop(at + length + 0.05);
    }
  }

  /** A plucked bass note. */
  private pluck(ctx: AudioContext, freq: number, at: number, length: number): void {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.28, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, at + length);
    o.connect(g).connect(this.gain!);
    o.start(at);
    o.stop(at + length + 0.05);
  }

  private noise: AudioBuffer | null = null;

  /** A soft shaker tick. */
  private shaker(ctx: AudioContext, at: number): void {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(filter).connect(g).connect(this.gain!);
    src.start(at);
  }
}
