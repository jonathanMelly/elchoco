// Readable on the cocoa background; kept apart from gold (my family), cyan (technical lights), alert (contested).
export const FAMILY_PALETTE = ['#7aa2ff', '#b48cff', '#5fd38d', '#f28cd5', '#c9a27e', '#e8e2d6', '#ff8a5c', '#8fd3ff'];
export const MY_COLOR = '#ffb13b';

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic colour per family id; the 9th family and beyond reuse colours with a hatch. */
export function colorsFor(ids, myFamily) {
  const out = new Map();
  const used = new Set();
  const others = [...new Set(ids)].filter((id) => id !== myFamily).sort();
  for (const id of others) {
    const start = fnv1a(id) % FAMILY_PALETTE.length;
    if (used.size < FAMILY_PALETTE.length) {
      let i = start;
      while (used.has(i)) i = (i + 1) % FAMILY_PALETTE.length;
      used.add(i);
      out.set(id, { color: FAMILY_PALETTE[i], hatch: false });
    } else {
      out.set(id, { color: FAMILY_PALETTE[start], hatch: true });
    }
  }
  if (ids.includes(myFamily)) out.set(myFamily, { color: MY_COLOR, hatch: false });
  return out;
}
