// Pure maths (no three): where the dial goes so it sits exactly behind a DOM element.

/** World-units-per-pixel on the z=0 plane for a perspective camera looking at the origin. */
export function worldPerPixel({ fov, z, viewport }) {
  const halfH = Math.tan((fov * Math.PI) / 360) * z;
  return (2 * halfH) / viewport.h;
}

/**
 * rect: getBoundingClientRect-like of the hub element. ringFraction: where the family nodes sit, as a
 * fraction of the hub half-size (0.8 = the SVG ring radius 80 of 100). ringRadius: world radius of the node ring.
 * Returns the rig position and uniform scale.
 */
export function hubPlacement({ rect, viewport, fov, z, ringFraction, ringRadius }) {
  const wpp = worldPerPixel({ fov, z, viewport });
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const half = Math.min(rect.width, rect.height) / 2;
  return {
    x: (cx - viewport.w / 2) * wpp,
    y: -(cy - viewport.h / 2) * wpp,
    scale: (half * ringFraction * wpp) / ringRadius,
  };
}
