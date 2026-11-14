// Recording fake of the Web Audio API: every create*() returns a permissive node.
const param = () => ({
  value: 0,
  setValueAtTime() {},
  linearRampToValueAtTime() {},
  exponentialRampToValueAtTime(v) {
    if (v === 0) throw new RangeError('exponentialRamp to 0');
  },
  setTargetAtTime() {},
  cancelScheduledValues() {},
});

function node() {
  const params = {};
  const self = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'connect') return (dest) => dest;
        if (prop in target) return target[prop];
        if (typeof prop === 'symbol' || prop === 'then') return undefined;
        if (['start', 'stop', 'disconnect'].includes(prop)) return () => self;
        return (params[prop] ??= param());
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    },
  );
  return self;
}

export function createFakeAudioContext() {
  const ctx = {
    created: 0,
    currentTime: 0,
    sampleRate: 48000,
    destination: node(),
    resume: () => Promise.resolve(),
    close: () => Promise.resolve(),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  for (const name of [
    'createGain', 'createOscillator', 'createBiquadFilter', 'createConvolver',
    'createBufferSource', 'createDynamicsCompressor',
  ]) {
    ctx[name] = () => {
      ctx.created++;
      return node();
    };
  }
  return ctx;
}
