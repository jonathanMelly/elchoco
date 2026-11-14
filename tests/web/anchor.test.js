import { describe, it, expect } from 'vitest';
import { hubPlacement } from '../../web/src/fx/anchor.js';

const cam = { fov: 50, z: 14 };
const viewport = { w: 1600, h: 900 };
const at = (left, top, size) => hubPlacement({ rect: { left, top, width: size, height: size }, viewport, ...cam, ringFraction: 0.8, ringRadius: 5.2 });

describe('hubPlacement', () => {
  it('puts a centred hub at the world origin', () => {
    const p = at(800 - 200, 450 - 200, 400);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });
  it('moves right/up in world space when the hub is right/up on screen', () => {
    const p = at(1000, 100, 400);
    expect(p.x).toBeGreaterThan(0);
    expect(p.y).toBeGreaterThan(0);
  });
  it('scales the dial so the node ring lands on 80% of the hub half-size', () => {
    const halfH = Math.tan((cam.fov * Math.PI) / 360) * cam.z;
    const wpp = (2 * halfH) / viewport.h;
    const p = at(0, 0, 400);
    expect(p.scale * 5.2).toBeCloseTo(200 * 0.8 * wpp);
  });
  it('is proportional to the hub size', () => {
    expect(at(0, 0, 800).scale).toBeCloseTo(at(0, 0, 400).scale * 2);
  });
});
