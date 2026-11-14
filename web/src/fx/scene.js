import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { palette } from './theme.js';
import { hubPlacement } from './anchor.js';
import { reveal } from './reveal.js';

const CENTRE = 'pod'; // 'pod' (cacao pod) or 'bar' (tiled chocolate bar): settle by eye
const NODE_RADIUS = 5.2;
const SEGMENTS = 18;
const MAX_BOLTS = 8;
const RING_FRACTION = 0.8; // family nodes sit at 80% of the hub half-size (SVG ring radius 80 of 100)
const DIM = 0x6b4a33; // melted square

const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, opacity, ...additive });

function circlePoints(r, n = 160, a0 = 0, a1 = Math.PI * 2) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
  });
}

function ring(r, color, opacity, { dashed = false, a0 = 0, a1 = Math.PI * 2 } = {}) {
  const geometry = new THREE.BufferGeometry().setFromPoints(circlePoints(r, 160, a0, a1));
  if (!dashed) return new THREE.Line(geometry, lineMat(color, opacity));
  const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color, opacity, dashSize: 0.12, gapSize: 0.08, ...additive }));
  line.computeLineDistances();
  return line;
}

function ticks(r, count, len, color, opacity) {
  const p = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const L = i % 5 === 0 ? len * 1.9 : len;
    p.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0), new THREE.Vector3(Math.cos(a) * (r - L), Math.sin(a) * (r - L), 0));
  }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(p), lineMat(color, opacity));
}

function createCentre() {
  const group = new THREE.Group();
  const wire = new THREE.MeshBasicMaterial({ color: palette.gold, wireframe: true, opacity: 0.35, ...additive });
  if (CENTRE === 'bar') {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.5, 4, 6, 1), wire));
  } else {
    // cacao pod: stretched ridged ellipsoid
    const geo = new THREE.SphereGeometry(1, 10, 18);
    const pod = new THREE.Mesh(geo, wire);
    pod.scale.set(0.95, 1.7, 0.95);
    group.add(pod);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshBasicMaterial({ color: 0xbdfcff }));
  group.add(core);
  return { group, core };
}

const CRT_SHADER = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 1 }, scan: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, grain, scan; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv - .5; float d = dot(c,c);
      vec2 off = c * d * .018;
      vec3 col = vec3(texture2D(tDiffuse, vUv+off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv-off).b);
      col *= 1. - .07 * scan + .07 * scan * sin(vUv.y * 900. + time * 6.);
      col += (h(vUv * 900. + time) - .5) * .035 * grain;
      col *= 1. - d * 1.4;
      gl_FragColor = vec4(col, 1.);
    }`,
};

/**
 * Decorative WebGL background. Throws when WebGL is unavailable: the caller handles it.
 * Scene = { setFamilies, setIntensity, setPhase, flash, dispose }
 */
export function startScene(canvas, { intensity = 'full' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  // dial: rings, each at its own speed
  const dial = new THREE.Group();
  const rings = [
    { obj: ring(5.2, palette.gold, 0.9), spin: 0 },
    { obj: ring(4.9, palette.gold, 0.5, { dashed: true }), spin: 0.15 },
    { obj: ticks(4.7, 120, 0.09, palette.gold, 0.8), spin: -0.08 },
    { obj: ring(4.1, palette.gold, 0.9, { a0: 0.2, a1: Math.PI * 1.5 }), spin: 0.4 }, // tempering gauge
    { obj: ring(3.7, palette.cyan, 0.5, { dashed: true }), spin: -0.3 },
    { obj: ring(3.3, palette.gold, 0.6, { a0: 1, a1: 4.2 }), spin: -0.7 },
    { obj: ticks(2.9, 60, 0.12, palette.gold, 0.7), spin: 0.25 },
  ];
  // in the HUD the dial is simplified: only the first four rings stay, the inner ones fade out
  rings.forEach((r, i) => {
    r.keep = i < 3;
    r.base = r.obj.material.opacity;
    dial.add(r.obj);
  });
  // rig = everything that belongs to the big clock; it shrinks into a corner once the HUD is on top
  const rig = new THREE.Group();
  scene.add(rig);
  rig.add(dial);

  const centre = createCentre();
  rig.add(centre.group);

  // family squares on the outer ring
  const nodes = new Group3();
  rig.add(nodes.group);
  const squareGeo = new THREE.PlaneGeometry(0.42, 0.42);
  const coreGeo = new THREE.PlaneGeometry(0.14, 0.14);
  const dripGeo = new THREE.BufferGeometry();
  const drips = new THREE.Points(dripGeo, new THREE.PointsMaterial({ color: DIM, size: 0.1, ...additive }));
  scene.add(drips);

  // sober ambient layer for the HUD: slow drifting cocoa beans (4 shapes, 4 sizes), independent of the clock
  function beanTexture(rotation, fat) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.translate(48, 48);
    g.rotate(rotation);
    const grad = g.createRadialGradient(-6, -4, 2, 0, 0, 34);
    grad.addColorStop(0, '#ffd98a');
    grad.addColorStop(0.6, '#ffb13b');
    grad.addColorStop(1, '#7a4a1c');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, 0, 34, 34 * fat, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(40, 18, 6, .85)'; // the crease of the bean
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-30, 0);
    g.quadraticCurveTo(0, 5 * (fat - 0.5), 30, 0);
    g.stroke();
    return new THREE.CanvasTexture(c);
  }
  // a broken piece of chocolate bar: a few bevelled squares with a ragged break
  function barTexture(rotation, cols, rows) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.translate(48, 48);
    g.rotate(rotation);
    const cell = 22;
    const w = cols * cell;
    const h = rows * cell;
    g.beginPath();
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(w / 2, -h / 2);
    g.lineTo(w / 2, h / 2 - 7); // ragged break on the right/bottom
    g.lineTo(w / 2 - 9, h / 2 - 2);
    g.lineTo(w / 2 - 15, h / 2 - 9);
    g.lineTo(w / 2 - 24, h / 2);
    g.lineTo(-w / 2, h / 2);
    g.closePath();
    g.clip();
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = -w / 2 + i * cell;
        const y = -h / 2 + j * cell;
        g.fillStyle = '#a65f2a';
        g.fillRect(x, y, cell, cell);
        g.fillStyle = '#d9954a'; // lit bevel, top-left
        g.fillRect(x, y, cell, 3);
        g.fillRect(x, y, 3, cell);
        g.fillStyle = '#4a2410'; // shadow bevel, bottom-right
        g.fillRect(x, y + cell - 3, cell, 3);
        g.fillRect(x + cell - 3, y, 3, cell);
        g.fillStyle = '#c47a38';
        g.fillRect(x + 6, y + 6, cell - 12, cell - 12);
      }
    }
    return new THREE.CanvasTexture(c);
  }
  const BEANS = [
    { bar: [0.5, 2, 2], size: 1.6, n: 5 },
    { bar: [-0.8, 2, 1], size: 1.4, n: 5 },
    { bar: [2.2, 3, 2], size: 1.9, n: 3 },
    { rot: 0.4, fat: 0.55, size: 0.5, n: 22 },
    { rot: -0.9, fat: 0.62, size: 0.7, n: 16 },
    { rot: 1.9, fat: 0.5, size: 0.4, n: 26 },
    { rot: 2.7, fat: 0.7, size: 0.95, n: 8 },
  ].map((spec) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(spec.n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: spec.bar ? barTexture(...spec.bar) : beanTexture(spec.rot, spec.fat), size: spec.size, opacity: 0, alphaTest: 0.02, ...additive });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return { geo, mat, points, pos, seeds: Array.from({ length: spec.n }, () => ({ x: Math.random(), y: Math.random(), v: 0.15 + Math.random() * 0.35, z: -2 - Math.random() * 7 })) };
  });
  let familyList = [];
  let nodeStates = [];

  function Group3() {
    this.group = new THREE.Group();
    this.clear = () => {
      for (const child of [...this.group.children]) {
        this.group.remove(child);
        child.traverse?.((o) => o.material?.dispose());
      }
    };
  }

  function nodePosition(i, n) {
    // same layout as the HTML ring: node 0 at the top, clockwise
    const a = Math.PI / 2 - (i / Math.max(n, 1)) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * NODE_RADIUS, Math.sin(a) * NODE_RADIUS, 0);
  }

  function setFamilies(list) {
    nodes.clear();
    familyList = list.map((f) => ({ id: f.id, state: f.state }));
    nodeStates = familyList.map((f, i) => {
      const open = f.state === 'open';
      const pos = nodePosition(i, familyList.length);
      const square = new THREE.Mesh(squareGeo, new THREE.MeshBasicMaterial({ color: open ? palette.gold : DIM, opacity: open ? 1 : 0.45, ...additive }));
      square.position.copy(pos);
      square.rotation.z = open ? 0 : 0.25; // a melted square sags
      nodes.group.add(square);
      if (open) {
        const dot = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: palette.cyan, ...additive }));
        dot.position.copy(pos);
        dot.position.z = 0.01;
        nodes.group.add(dot);
      }
      return { pos, open };
    });
    const down = nodeStates.filter((n) => !n.open);
    dripGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(down.length * 3), 3));
  }

  // lightning bolts: lines regenerated on demand
  const bolts = Array.from({ length: MAX_BOLTS }, () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3));
    const line = new THREE.Line(g, lineMat(0xffd27a, 0));
    line.frustumCulled = false;
    scene.add(line);
    return line;
  });
  let boltIndex = 0;

  function strike(target) {
    const line = bolts[boltIndex++ % MAX_BOLTS];
    const from = rig.position.clone();
    const d = new THREE.Vector3().subVectors(target, from);
    const n = new THREE.Vector3(-d.y, d.x, 0).normalize();
    const pos = line.geometry.attributes.position;
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const jitter = (Math.random() - 0.5) * 1.1 * Math.sin(t * Math.PI);
      const p = from.clone().lerp(target, t).addScaledVector(n, jitter);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    line.material.opacity = 0.95;
  }

  function flash(familyId) {
    let targets = nodeStates.map((n, i) => ({ n, i })).filter(({ n }) => n.open);
    if (familyId) {
      const i = familyList.findIndex((f) => f.id === familyId);
      if (i >= 0) targets = [{ n: nodeStates[i], i }];
    }
    if (!targets.length) return;
    const { n } = targets[Math.floor(Math.random() * targets.length)];
    for (let k = 0; k < 3; k++) strike(n.pos.clone().applyMatrix4(dial.matrixWorld));
  }

  // post-processing
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.6, 0.05);
  composer.addPass(bloom);
  const crt = new ShaderPass(CRT_SHADER);
  composer.addPass(crt);
  composer.addPass(new OutputPass());

  let level = intensity;
  let phase = 'black';
  canvas.style.opacity = '0';
  let phaseStart = performance.now();
  let raf = 0;
  let running = false;
  let nextAuto = 0;
  let last = performance.now();
  let elapsed = 0;
  let anchor = null; // DOM element the dial sits behind in the HUD phase
  let hudMix = 0; // 0 = big clock in the middle, 1 = small clock in the corner + ambient dust

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * (level === 'reduced' ? 0.5 : 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio?.(dpr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    const t = elapsed;

    rings.forEach((r) => (r.obj.rotation.z += r.spin * dt));
    centre.group.rotation.y += 0.25 * dt;
    centre.group.rotation.x = 0.35;
    centre.core.scale.setScalar(1 + 0.15 * Math.sin(t * 3));

    const sincePhase = (performance.now() - phaseStart) / 1000;
    const grow = phase === 'intro' ? Math.min(sincePhase / 3.5, 1) : 1;
    const breathe = phase === 'attract' ? 1 + 0.03 * Math.sin(t * 1.5) : 1;
    hudMix += ((phase === 'hud' && anchor ? 1 : 0) - hudMix) * (1 - Math.exp(-dt * 2.2));
    const m = hudMix * hudMix * (3 - 2 * hudMix); // smoothstep
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;
    // HUD: the dial sits exactly behind the hub element (it follows the page scroll); otherwise big and centred
    const bigScale = (0.6 + 0.4 * grow) * breathe;
    let rigScale = bigScale;
    rig.position.set(0, 0, 0);
    if (anchor) {
      const place = hubPlacement({
        rect: anchor.getBoundingClientRect(),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        fov: camera.fov,
        z: camera.position.z,
        ringFraction: RING_FRACTION,
        ringRadius: NODE_RADIUS,
      });
      rigScale = bigScale + (place.scale - bigScale) * m;
      rig.position.set(place.x * m, place.y * m, 0);
    }
    rig.scale.setScalar(rigScale);
    // intro: the rings light up one after another, then the centre and the families
    const intro = phase === 'intro';
    rings.forEach((r, i) => {
      r.obj.material.opacity = r.base * (intro ? reveal(sincePhase, i) : 1) * (r.keep ? 1 : 1 - m);
    });
    const centreIn = intro ? reveal(sincePhase, rings.length, { step: 1, dur: 1.5 }) : 1;
    nodes.group.visible = m < 0.5 && centreIn > 0.5;
    centre.group.scale.setScalar(Math.max((1 - m * 1.4) * centreIn, 0.001));
    centre.group.visible = m < 0.7;

    BEANS.forEach((bean, k) => {
      bean.mat.opacity = 0.55 * m;
      bean.points.visible = m > 0.01;
      if (!bean.points.visible) return;
      bean.seeds.forEach((d, i) => {
        const yy = (d.y + t * d.v * 0.03) % 1;
        bean.pos[i * 3] = (d.x * 2 - 1) * halfW * 1.1 + Math.sin(t * 0.3 + i + k) * 0.2;
        bean.pos[i * 3 + 1] = (yy * 2 - 1) * halfH * 1.1;
        bean.pos[i * 3 + 2] = d.z;
      });
      bean.geo.attributes.position.needsUpdate = true;
    });

    // drips under melted squares
    const down = nodeStates.filter((n) => !n.open);
    const dp = dripGeo.attributes.position;
    if (dp) {
      down.forEach((n, i) => {
        const k = (t * 0.5 + i * 0.37) % 1;
        const p = n.pos.clone().applyMatrix4(dial.matrixWorld);
        dp.setXYZ(i, p.x, p.y - (0.25 + k * 0.7) * rigScale, 0);
      });
      dp.needsUpdate = true;
    }

    // idle lightning, more of it while the HUD is not on top
    if (t > nextAuto) {
      nextAuto = t + (phase === 'hud' ? 2.5 : 0.8) + Math.random() * 2;
      flash();
    }
    bolts.forEach((b) => (b.material.opacity *= 0.78));

    bloom.strength = level === 'reduced' ? 0.45 : 0.9;
    crt.uniforms.time.value = t;
    crt.uniforms.scan.value = 1 - 0.9 * m; // scanlines alias against the DOM on top of them: fade them out in the HUD
    crt.uniforms.grain.value = level === 'reduced' ? 0 : 1 - 0.85 * m;
    // no camera drift once the dial is pinned behind the hub, or it would slide against the DOM
    camera.position.x = Math.sin(t * 0.2) * 0.6 * (1 - m);
    camera.position.y = Math.cos(t * 0.17) * 0.4 * (1 - m);
    camera.lookAt(0, 0, 0);
    rig.updateMatrixWorld(true);
    composer.render();
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    resize();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    renderer.clear();
  }

  function setIntensity(next) {
    const wasNone = level === 'none';
    level = next;
    if (level === 'none') return stop();
    resize();
    if (wasNone) start();
  }

  window.addEventListener('resize', resize);
  if (level !== 'none') start();

  return {
    setFamilies,
    setIntensity,
    setPhase(next) {
      phase = next;
      phaseStart = performance.now();
      // 'black' = prestep: the canvas stays dark; any other phase fades the scene in (CSS transition on #fx)
      canvas.style.opacity = next === 'black' ? '0' : '1';
    },
    flash,
    /** 0..1: how far the big clock has travelled into its place behind the hub. */
    hudProgress: () => hudMix,
    setAnchor(el) {
      anchor = el ?? null;
    },
    dispose() {
      stop();
      window.removeEventListener('resize', resize);
      scene.traverse((o) => {
        o.geometry?.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
      composer.dispose?.();
      renderer.dispose();
    },
  };
}
