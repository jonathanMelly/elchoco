/** Smooth 0..1 reveal of the n-th item, `step` seconds after the previous one, over `dur` seconds. */
export function reveal(seconds, index, { step = 0.8, dur = 1 } = {}) {
  const x = Math.min(Math.max((seconds - index * step) / dur, 0), 1);
  return x * x * (3 - 2 * x);
}
