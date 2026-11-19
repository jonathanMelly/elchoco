import { createStore, restoreActivity } from './state/store.js';
import { createOptions, defaultOptions } from './state/options.js';
import { connectBus } from './bus.js';
import { mountShell } from './shell.js';

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const options = createOptions({
  storage: safeLocalStorage(),
  defaults: defaultOptions({
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  }),
});
const store = createStore();

// Observed activity survives a reload (this console's own history, not a journal service).
const ACTIVITY_KEY = 'elchoco.hud.activity';
try {
  store.activity.push(...restoreActivity(window.localStorage.getItem(ACTIVITY_KEY)));
} catch {
  /* storage unavailable */
}
let saveTimer = null;
store.subscribe(() => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(store.activity));
    } catch {
      /* storage unavailable */
    }
  }, 2000);
});

// The visual layer is optional: no fx folder, no WebGL or effects "none" leave a working console.
let fx = null;
let scene = null;
if (options.get('effects') !== 'none') {
  try {
    fx = await import('./fx/index.js');
    scene = fx.startScene(document.getElementById('fx'), { intensity: options.get('effects') });
  } catch (err) {
    console.warn('effets désactivés :', err);
    fx = null;
    scene = null;
  }
}

const overlay = document.getElementById('overlay');
let sound = null;
let shell = null;
let status = 'connecting';

const bus = connectBus({
  store,
  onStatus: (s) => {
    status = s;
    shell?.setStatus(s);
  },
});

// Black prestep (click = the gesture that unlocks audio) -> rings light up with the intro music, wait on
// ENTRER -> boot lines and welcome -> fade to the HUD with the lighter music. Without fx: straight to the HUD.
const fadeOut = async (el) => {
  el.classList.add('fading');
  await new Promise((r) => setTimeout(r, 1200));
  el.classList.remove('fading', 'intro');
  el.textContent = '';
};
if (fx && options.get('skipIntro')) {
  // No gesture to unlock audio: create the sound engine now and let it start on the first click or key.
  try {
    sound = fx.createSound({ getOptions: () => options.all() });
    sound.music('hud');
    const unlock = () => {
      sound.start();
      for (const e of ['keydown', 'pointerdown']) globalThis.removeEventListener(e, unlock);
    };
    for (const e of ['keydown', 'pointerdown']) globalThis.addEventListener(e, unlock);
  } catch (err) {
    console.warn('son désactivé :', err);
  }
  scene?.setPhase('hud');
} else if (fx) {
  try {
    await fx.showStart({ el: overlay, scene });
    sound = fx.createSound({ getOptions: () => options.all() });
    sound.music('intro');
    sound.start();
    scene?.setPhase('intro');
    await fx.showAttract({ el: overlay });
    sound.play('click');
    overlay.classList.add('intro');
    await fx.runIntro({ el: overlay, scene, sound, options });
  } catch (err) {
    console.warn('intro désactivée :', err);
  }
  sound?.music('hud');
  await fadeOut(overlay);
}

shell = mountShell(document.getElementById('panels'), { store, options });
shell.setStatus(status);

// Transitions only from now on: the retained burst (connect, reconnect) must not make noise.
const lastState = new Map(store.families.list().map((f) => [f.id, f.state]));
store.families.subscribe((f, prev) => {
  if (prev?.state === 'open' && (f.state === 'closed' || f.state === 'died')) sound?.play('family-down');
  if (f.state === 'open' && (prev?.state ?? lastState.get(f.id)) !== 'open') {
    sound?.play('family-up');
    scene?.flash(f.id);
  }
  lastState.set(f.id, f.state);
});

if (scene) {
  scene.setPhase('hud');
  scene.setAnchor(shell.hub); // the dial sits behind the round hub
  // The hub (family ring + map) stays hidden until the big clock has merged into it.
  const panelsEl = document.getElementById('panels');
  panelsEl.classList.add('entering');
  const settle = setInterval(() => {
    if (scene.hudProgress() > 0.97) {
      clearInterval(settle);
      panelsEl.classList.remove('entering');
    }
  }, 100);
  setTimeout(() => {
    clearInterval(settle);
    panelsEl.classList.remove('entering');
  }, 6000); // safety net
  scene.setFamilies(store.families.list());
  store.families.subscribe(() => scene.setFamilies(store.families.list()));
}

options.subscribe(async (key, value) => {
  if (key === 'volume' || key === 'muted' || key === 'music') {
    sound?.update();
  } else if (key === 'effects') {
    if (scene) scene.setIntensity(value);
    else if (value !== 'none' && !fx) {
      try {
        fx = await import('./fx/index.js');
        scene = fx.startScene(document.getElementById('fx'), { intensity: value });
        scene.setAnchor(shell.hub);
        scene.setPhase('hud');
        scene.setFamilies(store.families.list());
        store.families.subscribe(() => scene.setFamilies(store.families.list()));
      } catch (err) {
        console.warn('effets désactivés :', err);
        fx = null;
        scene = null;
      }
    }
  }
});
