/** Prestep: a black screen with a breathing light. Browsers only allow sound after a gesture. */
export function showStart({ el, scene }) {
  scene?.setPhase('black');
  el.textContent = '';
  const box = document.createElement('div');
  box.className = 'start';
  const glow = document.createElement('div');
  glow.className = 'start-glow';
  const text = document.createElement('p');
  text.className = 'start-text';
  text.textContent = "Cliquez ou appuyez sur une touche pour commencer l'aventure";
  box.append(glow, text);
  el.append(box);

  return new Promise((resolve) => {
    const done = () => {
      globalThis.removeEventListener('pointerdown', done);
      globalThis.removeEventListener('keydown', done);
      resolve();
    };
    globalThis.addEventListener('pointerdown', done);
    globalThis.addEventListener('keydown', done);
  });
}

/** Last step of the intro: the welcome line and the ENTRER button. Resolves on click or key. */
export function showAttract({ el, title = 'PATRÓN, VOTRE CONSOLE VOUS ATTEND' }) {
  el.textContent = '';
  const box = document.createElement('div');
  box.className = 'attract';
  const heading = document.createElement('p');
  heading.className = 'attract-title';
  heading.textContent = title;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'attract-enter';
  btn.textContent = 'ENTRER';
  box.append(heading, btn);
  el.append(box);
  btn.focus();

  return new Promise((resolve) => {
    const done = () => {
      btn.removeEventListener('click', done);
      globalThis.removeEventListener('keydown', done);
      resolve();
    };
    btn.addEventListener('click', done);
    globalThis.addEventListener('keydown', done);
  });
}
