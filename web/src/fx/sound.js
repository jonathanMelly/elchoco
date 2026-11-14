// Synthesized soundscape. No audio files; every sound sits in the SOUNDS table below.
export const SOUND_EVENTS = ['boot-line', 'welcome', 'family-up', 'family-down', 'bolt', 'click'];

const FLOOR = 0.0001; // never ramp to 0: exponentialRampToValueAtTime(0) throws

/** Soft envelope: attack >= 5 ms, long exponential decay. */
function envelope(ctx, gain, { peak = 0.25, attack = 0.01, decay = 0.4 } = {}) {
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(FLOOR, t);
  gain.gain.linearRampToValueAtTime(peak, t + Math.max(attack, 0.005));
  gain.gain.exponentialRampToValueAtTime(FLOOR, t + attack + decay);
  return t + attack + decay;
}

function noiseSource(ctx, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function fmBell(ctx, out, freq, { peak = 0.2, decay = 0.5 } = {}) {
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const amp = ctx.createGain();
  carrier.type = 'sine';
  mod.type = 'sine';
  carrier.frequency.value = freq;
  mod.frequency.value = freq * 3.5;
  const t = ctx.currentTime;
  modGain.gain.setValueAtTime(freq * 2, t);
  modGain.gain.exponentialRampToValueAtTime(FLOOR, t + 0.3);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(amp);
  amp.connect(out);
  const end = envelope(ctx, amp, { peak, attack: 0.006, decay });
  carrier.start(t);
  mod.start(t);
  carrier.stop(end + 0.05);
  mod.stop(end + 0.05);
}

const SOUNDS = {
  'family-up': (ctx, out) => {
    const src = noiseSource(ctx, 0.1);
    const band = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    band.type = 'bandpass';
    band.frequency.value = 2000;
    band.Q.value = 4;
    src.connect(band);
    band.connect(amp);
    amp.connect(out);
    envelope(ctx, amp, { peak: 0.3, attack: 0.005, decay: 0.08 });
    src.start(ctx.currentTime);
  },
  'family-down': (ctx, out) => {
    const osc = ctx.createOscillator();
    const low = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    osc.type = 'triangle';
    low.type = 'lowpass';
    low.frequency.value = 900;
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.8);
    osc.connect(low);
    low.connect(amp);
    amp.connect(out);
    const end = envelope(ctx, amp, { peak: 0.25, attack: 0.02, decay: 0.8 });
    osc.start(t);
    osc.stop(end + 0.05);
  },
  'boot-line': (ctx, out) => fmBell(ctx, out, 880, { peak: 0.15, decay: 0.3 }),
  click: (ctx, out) => fmBell(ctx, out, 1320, { peak: 0.12, decay: 0.15 }),
  welcome: (ctx, out) => {
    [392, 494, 587].forEach((f, i) => {
      setTimeout(() => {
        try {
          fmBell(ctx, out, f, { peak: 0.2, decay: 2.2 });
        } catch {
          /* context may be closed meanwhile */
        }
      }, i * 160);
    });
    fmBell(ctx, out, 196, { peak: 0.22, decay: 2.5 });
  },
  bolt: (ctx, out) => {
    const src = noiseSource(ctx, 0.12);
    const high = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    high.type = 'highpass';
    high.frequency.value = 3000;
    src.connect(high);
    high.connect(amp);
    amp.connect(out);
    const t = ctx.currentTime;
    amp.gain.setValueAtTime(FLOOR, t);
    for (let i = 1; i <= 6; i++) amp.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.2, t + i * 0.02);
    amp.gain.linearRampToValueAtTime(FLOOR, t + 0.14);
    src.start(t);
  },
};

/** Reverb impulse response: 2.5 s of decaying noise. */
function impulse(ctx, seconds = 2.5) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
  }
  return buf;
}

// --- Chiptune music: 16th-note step patterns, MIDI notes, null = rest. Game Boy style:
// a pulse lead, a triangle bass, a tiny noise tick. Everything is synthesized.
export const midiToHz = (n) => 440 * 2 ** ((n - 69) / 12);

const steps = (len, map) => Array.from({ length: len }, (_, i) => map[i] ?? null);

export const TRACKS = {
  // Intro: A minor, a bit dramatic, rising arpeggios (2 bars).
  intro: {
    bpm: 108,
    lead: steps(32, { 0: 69, 2: 72, 4: 76, 6: 72, 8: 69, 10: 72, 12: 77, 14: 76, 16: 74, 18: 77, 20: 81, 22: 77, 24: 76, 26: 72, 28: 71, 30: 68 }),
    bass: steps(32, { 0: 45, 4: 45, 8: 45, 12: 45, 16: 41, 20: 41, 24: 40, 28: 40 }),
    tick: steps(32, { 2: 1, 6: 1, 10: 1, 14: 1, 18: 1, 22: 1, 26: 1, 30: 1 }),
  },
  // HUD: light, slow, sparse A minor pentatonic (4 bars). Stays out of the way.
  hud: {
    bpm: 78,
    lead: steps(64, { 0: 69, 6: 72, 10: 67, 16: 64, 22: 67, 28: 62, 32: 60, 38: 64, 42: 69, 48: 67, 54: 64, 58: 62 }),
    bass: steps(64, { 0: 45, 16: 41, 32: 48, 48: 43 }),
    tick: steps(64, { 8: 1, 24: 1, 40: 1, 56: 1 }),
  },
};

const MUSIC_PEAK = 0.05; // very low: ambience, never the main event

function pulse(ctx, out, freq, t, dur, peak) {
  const osc = ctx.createOscillator();
  const low = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  low.type = 'lowpass';
  low.frequency.value = 2200; // takes the harsh edge off the square
  osc.connect(low);
  low.connect(amp);
  amp.connect(out);
  amp.gain.setValueAtTime(FLOOR, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function triangleBass(ctx, out, freq, t, dur, peak) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  osc.connect(amp);
  amp.connect(out);
  amp.gain.setValueAtTime(FLOOR, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function tick(ctx, out, t, peak) {
  const src = noiseSource(ctx, 0.04);
  const high = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  high.type = 'highpass';
  high.frequency.value = 6000;
  src.connect(high);
  high.connect(amp);
  amp.connect(out);
  amp.gain.setValueAtTime(FLOOR, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.005);
  amp.gain.exponentialRampToValueAtTime(FLOOR, t + 0.04);
  src.start(t);
}

export function createSound({
  audioFactory = () => new AudioContext(),
  getOptions,
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = (id) => clearInterval(id),
}) {
  let ctx = null;
  let master = null;
  let bus = null;
  let pad = [];
  let wanted = null; // track the caller asked for, even while music is off
  let playing = null; // { name, gain, timer }

  const level = () => {
    const { volume = 0.4, muted = false } = getOptions();
    return muted ? FLOOR : Math.max(FLOOR, volume * 0.5);
  };

  function start() {
    if (ctx) return;
    ctx = audioFactory();
    ctx.resume?.();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);

    // Dry + reverb bus shared by every event.
    bus = ctx.createGain();
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    bus.connect(master);
    bus.connect(reverb);
    reverb.connect(wet);
    wet.connect(master);

    // Soft pad: two detuned oscillators through a low-pass with a slow LFO, fading in over 3 s.
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 500;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(low.frequency);
    const padGain = ctx.createGain();
    const t = ctx.currentTime;
    padGain.gain.setValueAtTime(FLOOR, t);
    padGain.gain.linearRampToValueAtTime(0.12, t + 3);
    low.connect(padGain);
    padGain.connect(master);
    const oscs = [
      ['sine', 98],
      ['triangle', 98.7],
    ].map(([type, f]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(low);
      o.start(t);
      return o;
    });
    lfo.start(t);
    pad = [...oscs, lfo];
    if (wanted && musicOn()) startMusic(wanted);
  }

  const musicOn = () => getOptions().music !== false && !getOptions().muted;

  function stopMusic() {
    if (!playing) return;
    const { gain, timer } = playing;
    clearTimer(timer);
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value || MUSIC_PEAK, FLOOR), t);
    gain.gain.linearRampToValueAtTime(FLOOR, t + 0.4);
    playing = null;
  }

  function startMusic(name) {
    const track = TRACKS[name];
    if (!ctx || !track || playing) return;
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(FLOOR, t0);
    gain.gain.linearRampToValueAtTime(1, t0 + 1.5); // fade in
    gain.connect(master);
    const stepSec = 60 / track.bpm / 4;
    let i = 0;
    let next = t0 + 0.1;
    const schedule = () => {
      if (!ctx) return;
      while (next < ctx.currentTime + 0.5) {
        const k = i % track.lead.length;
        if (track.lead[k] !== null) pulse(ctx, gain, midiToHz(track.lead[k]), next, stepSec * 3, MUSIC_PEAK);
        if (track.bass[k] !== null) triangleBass(ctx, gain, midiToHz(track.bass[k]), next, stepSec * 6, MUSIC_PEAK * 1.4);
        if (track.tick[k]) tick(ctx, gain, next, MUSIC_PEAK * 0.5);
        next += stepSec;
        i++;
      }
    };
    schedule();
    playing = { name, gain, timer: setTimer(schedule, 120) };
  }

  /** Start a looping track ('intro' | 'hud'), or stop with null. Switching cross-fades. */
  function music(name) {
    wanted = name ?? null;
    if (!ctx) return;
    if (playing && playing.name !== wanted) stopMusic();
    if (wanted && TRACKS[wanted] && musicOn()) startMusic(wanted);
  }

  function update() {
    if (!ctx) return;
    if (!musicOn()) stopMusic();
    else if (wanted) startMusic(wanted);
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(level(), t + 0.1);
  }

  function play(event) {
    if (!ctx || getOptions().muted) return;
    const make = SOUNDS[event];
    if (!make) return;
    make(ctx, bus);
  }

  function stop() {
    if (!ctx) return;
    stopMusic();
    wanted = null;
    const c = ctx;
    const t = c.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(FLOOR, t + 0.3);
    for (const o of pad) {
      try {
        o.stop(t + 0.35);
      } catch {
        /* already stopped */
      }
    }
    ctx = null;
    master = null;
    bus = null;
    pad = [];
    setTimeout(() => c.close?.(), 400);
  }

  return { start, play, update, stop, music };
}
