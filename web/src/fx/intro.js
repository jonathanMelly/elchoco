const HUMOUR_LINES = [
  'Tempérage du Forastero…',
  'Cumulus détecté, trésorerie en CHF…',
  'Corruption du Contador : OK',
  'Allumage des anneaux de pouvoir…',
];
const NEUTRAL_LINES = ['Connexion au broker…', 'Chargement des familles…', "Synchronisation de l'horloge…"];

export const introLines = ({ humour }) => [...(humour ? HUMOUR_LINES : NEUTRAL_LINES)];

export function welcomeText(patronName) {
  const name = String(patronName ?? '').trim();
  return `BIENVENIDO, PATRÓN ${name}`.trim().toLocaleUpperCase('fr-CH').replace(/\s+$/, '');
}

const LINE_MS = 1100;
const GUARD_MS = 300;

/** Boot-sequence intro (~8 s). A key or click skips to the end. */
export async function runIntro({
  el,
  scene,
  sound,
  options,
  wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  signal,
}) {
  if (options.get('skipIntro')) return;

  let skipped = false;
  const skip = () => {
    skipped = true;
  };
  const events = ['keydown', 'pointerdown'];
  let armed = false;
  const arm = setTimeout(() => {
    armed = true;
    for (const e of events) globalThis.addEventListener?.(e, skip);
  }, GUARD_MS);
  // Listeners are tracked so a resolve before the guard still leaves nothing behind.
  const cleanup = () => {
    clearTimeout(arm);
    if (armed) for (const e of events) globalThis.removeEventListener?.(e, skip);
  };

  try {
    const shown = [];
    for (const line of introLines({ humour: options.get('humour') })) {
      if (skipped || signal?.aborted) break;
      shown.push(line);
      el.textContent = shown.join('\n');
      sound?.play('boot-line');
      await wait(LINE_MS);
    }
    el.textContent = welcomeText(options.get('patronName'));
    sound?.play('welcome');
    scene?.flash();
    if (!skipped) await wait(1800);
  } finally {
    cleanup();
  }
}
