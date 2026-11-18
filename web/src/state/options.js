import { SLUG_RE } from './protocol.js';

const STORAGE_KEY = 'elchoco.hud.options';

export function defaultOptions({ reducedMotion = false } = {}) {
  return {
    volume: 0.4,
    muted: false,
    effects: reducedMotion ? 'reduced' : 'full',
    skipIntro: false,
    myFamily: 'don-freey',
    patronName: 'Don Freey',
    music: true,
    humour: true,
    rawLog: false,
  };
}

const isBool = (v) => typeof v === 'boolean';
const isText = (v) => typeof v === 'string' && v.trim().length > 0;

// Each validator returns the normalised value, or undefined when invalid.
const VALIDATORS = {
  volume: (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined),
  muted: (v) => (isBool(v) ? v : undefined),
  effects: (v) => (['full', 'reduced', 'none'].includes(v) ? v : undefined),
  skipIntro: (v) => (isBool(v) ? v : undefined),
  myFamily: (v) => (typeof v === 'string' && SLUG_RE.test(v) ? v : undefined),
  patronName: (v) => (isText(v) ? v : undefined),
  music: (v) => (isBool(v) ? v : undefined),
  humour: (v) => (isBool(v) ? v : undefined),
  rawLog: (v) => (isBool(v) ? v : undefined),
};

export function createOptions({ storage, defaults = defaultOptions() } = {}) {
  const values = { ...defaults };
  const listeners = new Set();

  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      for (const key of Object.keys(VALIDATORS)) {
        if (key in stored) {
          const v = VALIDATORS[key](stored[key]);
          if (v !== undefined) values[key] = v;
        }
      }
    }
  } catch {
    // corrupt or unavailable storage: defaults stay
  }

  function persist() {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // storage unavailable: keep in memory only
    }
  }

  return {
    get: (key) => values[key],
    all: () => ({ ...values }),
    set(key, value) {
      const validate = VALIDATORS[key];
      if (!validate) return;
      const v = validate(value);
      if (v === undefined || v === values[key]) return;
      values[key] = v;
      persist();
      for (const fn of [...listeners]) fn(key, v);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
