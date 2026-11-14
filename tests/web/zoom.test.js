import { describe, it, expect } from 'vitest';
import { zoomBox, panBox } from '../../web/src/panels/map-geometry.js';

const box = [0, 0, 100, 50];

describe('zoomBox', () => {
  it('keeps the point under the cursor fixed', () => {
    const [x, y, w, h] = zoomBox(box, 2, 0.25, 0.5);
    expect(w).toBe(50);
    expect(h).toBe(25);
    expect(x + 0.25 * w).toBeCloseTo(25);
    expect(y + 0.5 * h).toBeCloseTo(25);
  });
  it('clamps between max zoom-in and the full box', () => {
    expect(zoomBox(box, 1000, 0.5, 0.5, { full: box })[2]).toBeGreaterThan(0);
    expect(zoomBox(box, 0.1, 0.5, 0.5, { full: box })).toEqual(box);
  });
});

describe('panBox', () => {
  it('moves by a fraction of the box and stays inside full', () => {
    expect(panBox([10, 10, 20, 10], 0.5, 0, { full: box })).toEqual([20, 10, 20, 10]);
    expect(panBox([10, 10, 20, 10], 100, 100, { full: box })).toEqual([80, 40, 20, 10]);
  });
});
