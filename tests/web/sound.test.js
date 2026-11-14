import { describe, it, expect } from 'vitest';
import { createSound, SOUND_EVENTS, TRACKS, midiToHz } from '../../web/src/fx/sound.js';
import { createFakeAudioContext } from './fake-audio.js';

function setup(opts = { volume: 0.4, muted: false }) {
  let factoryCalls = 0;
  let ctx;
  const state = { ...opts };
  const sound = createSound({
    audioFactory: () => {
      factoryCalls++;
      ctx = createFakeAudioContext();
      return ctx;
    },
    getOptions: () => state,
  });
  return { sound, state, calls: () => factoryCalls, ctx: () => ctx };
}

describe('sound', () => {
  it('does nothing before start()', () => {
    const s = setup();
    s.sound.play('click');
    expect(s.calls()).toBe(0);
  });

  it('start() is idempotent', () => {
    const s = setup();
    s.sound.start();
    s.sound.start();
    expect(s.calls()).toBe(1);
  });

  it('ignores unknown events and creates no node', () => {
    const s = setup();
    s.sound.start();
    const before = s.ctx().created;
    expect(() => s.sound.play('nope')).not.toThrow();
    expect(s.ctx().created).toBe(before);
  });

  it('is silent while muted', () => {
    const s = setup({ volume: 0.4, muted: true });
    s.sound.start();
    const before = s.ctx().created;
    s.sound.play('click');
    expect(s.ctx().created).toBe(before);
  });

  it('plays every event without throwing (no ramp to 0)', () => {
    const s = setup();
    s.sound.start();
    for (const e of SOUND_EVENTS) {
      const before = s.ctx().created;
      expect(() => s.sound.play(e)).not.toThrow();
      expect(s.ctx().created).toBeGreaterThan(before);
    }
  });

  it('update() and stop() do not throw', () => {
    const s = setup();
    s.sound.start();
    s.state.muted = true;
    expect(() => s.sound.update()).not.toThrow();
    expect(() => s.sound.stop()).not.toThrow();
    expect(() => s.sound.play('click')).not.toThrow();
  });
});

describe('chiptune music', () => {
  it('has an intro and a hud track with valid notes', () => {
    for (const name of ['intro', 'hud']) {
      const t = TRACKS[name];
      expect(t.bpm).toBeGreaterThan(40);
      expect(t.lead.length).toBeGreaterThan(0);
      expect(t.lead.length % 16).toBe(0);
      expect(t.bass.length).toBe(t.lead.length);
      for (const n of [...t.lead, ...t.bass]) expect(n === null || (Number.isInteger(n) && n >= 24 && n <= 96)).toBe(true);
    }
    expect(midiToHz(69)).toBe(440);
  });

  it('music() before start, unknown track and muted music create nothing', () => {
    const s = setup({ volume: 0.4, muted: false, music: true });
    s.sound.music('hud');
    expect(s.calls()).toBe(0);
    s.sound.start();
    const before = s.ctx().created;
    s.sound.music('nope');
    s.state.music = false;
    s.sound.music('hud');
    expect(s.ctx().created).toBe(before);
    s.sound.stop();
  });

  it('schedules notes through a fake timer and stops cleanly', () => {
    const timers = [];
    const s = setup({ volume: 0.4, muted: false, music: true });
    const sound = createSound({
      audioFactory: () => createFakeAudioContext(),
      getOptions: () => s.state,
      setTimer: (fn) => { timers.push(fn); return timers.length; },
      clearTimer: () => {},
    });
    sound.start();
    sound.music('intro');
    expect(timers.length).toBe(1);
    for (let i = 0; i < 3; i++) timers.at(-1)();
    expect(() => sound.music(null)).not.toThrow();
    expect(() => sound.music('hud')).not.toThrow();
    expect(() => sound.stop()).not.toThrow();
  });
});
