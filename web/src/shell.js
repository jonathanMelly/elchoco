import { escapeHtml as e } from './util/escape.js';
import { panels } from './panels/registry.js';
import families, { ringView, mountFamilyDetail } from './panels/families.js';
import { mountReactive } from './panels/reactive.js';
import { mountCompact } from './panels/map.js';

const STATUS_LABEL = { connecting: 'connexion…', connected: 'connecté', reconnecting: 'reconnexion…', offline: 'hors ligne' };
const STATUS_LIGHT = { connecting: 'stale', connected: 'synced', reconnecting: 'stale', offline: 'local' };
// Panels that get a tab in the expanded view, in order. A missing panel simply has no tab.
const TAB_IDS = ['families', 'map', 'services', 'log', 'options'];

/** Numbered tech buttons, one per panel; a click opens that panel. */
export function navView(tabs) {
  return tabs
    .map((p, i) => `<button type="button" class="tech" data-open="${e(p.id)}"><span class="idx">${String(i + 1).padStart(2, '0')}</span><span class="tlabel">${e(p.title)}</span></button>`)
    .join('');
}

export function mountShell(root, ctx) {
  const byId = new Map(panels.map((p) => [p.id, p]));
  const tabs = TAB_IDS.map((id) => byId.get(id)).filter(Boolean);

  root.innerHTML = `<div class="shell">
<header class="bar"><div id="c-my-family" class="card"></div><div id="c-clock" class="card"></div><div class="card status"><div class="status-line"><span class="light" id="status-light"></span> <span id="status-text"></span></div><nav class="tech-nav" id="tech-nav">${navView(tabs)}</nav></div></header>
<section class="hub-card"><div class="hub" id="hub"><div class="hub-ring" id="c-ring"></div><button type="button" class="hub-map" id="hub-map" aria-label="Ouvrir la carte des territoires"></button></div></section>
<section class="card" id="c-services"></section>
<div class="detail" id="detail" hidden>
  <div class="detail-head"><nav id="tabs">${tabs.map((p) => `<button type="button" class="tech" data-tab="${e(p.id)}">${e(p.title)}</button>`).join('')}</nav><button type="button" id="close" aria-label="Fermer">✕</button></div>
  <div class="detail-body" id="detail-body"></div>
</div></div>`;

  const q = (sel) => root.querySelector(sel);
  const unmounts = [];
  const mountPanel = (id, sel) => {
    const p = byId.get(id);
    if (p) unmounts.push(p.mount(q(sel), ctx));
  };
  mountPanel('my-family', '#c-my-family');
  mountPanel('clock', '#c-clock');
  mountPanel('services', '#c-services');
  // The full map (framings, zoom, legend) lives on the main page; it is also a tab.
  // The map lives inside the round hub (compact); a click opens the full map in an animated pane.
  if (byId.has('map')) unmounts.push(mountCompact(q('#hub-map'), ctx));
  else q('#hub-map').remove();
  unmounts.push(mountReactive(q('#c-ring'), ctx, { select: families.select, view: ringView }));

  let current = null;
  let unmountTab = null;
  const openTab = (id) => {
    if (unmountTab) unmountTab();
    const p = byId.get(id);
    current = id;
    q('#detail').hidden = false;
    unmountTab = p.mount(q('#detail-body'), ctx);
    root.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    root.querySelectorAll('#tech-nav button').forEach((b) => b.classList.toggle('on', b.dataset.open === id));
  };
  const close = () => {
    if (unmountTab) unmountTab();
    unmountTab = null;
    current = null;
    root.querySelectorAll('#tech-nav button').forEach((b) => b.classList.remove('on'));
    q('#detail').hidden = true;
  };

  let pop = null;
  const smallTransform = (from, to) => {
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  };
  // One animated pane for both the map and a family card; it grows out of `originEl`.
  const openPane = (title, originEl, mountBody, cls = '') => {
    if (pop) return;
    const back = document.createElement('div');
    back.className = 'map-pop-back';
    const box = document.createElement('div');
    box.className = `map-pop ${cls}`.trim();
    box.innerHTML = `<div class="map-pop-head"><h2>${e(title)}</h2><button type="button" id="map-close" aria-label="Fermer">✕</button></div><div class="map-pop-body"></div>`;
    root.append(back, box);
    const unmount = mountBody(box.querySelector('.map-pop-body'));
    pop = { box, back, unmount, originEl };
    if (box.animate) {
      const small = smallTransform(originEl.getBoundingClientRect(), box.getBoundingClientRect());
      box.animate([{ transform: small, opacity: 0, borderRadius: '50%' }, { transform: 'none', opacity: 1, borderRadius: '14px' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
      back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'both' });
    }
  };
  const openMap = () => {
    const map = byId.get('map');
    if (map) openPane('Territoires', q('#hub-map'), (body) => map.mount(body, ctx));
  };
  const openFamily = (id, node) => openPane('Famille', node, (body) => mountFamilyDetail(body, ctx, id), 'small');
  const closeMap = () => {
    if (!pop) return;
    const { box, back, unmount, originEl } = pop;
    pop = null;
    const finish = () => {
      unmount();
      box.remove();
      back.remove();
    };
    if (!box.animate) return finish();
    const small = smallTransform((originEl.isConnected ? originEl : q('#hub-map')).getBoundingClientRect(), box.getBoundingClientRect());
    back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'both' });
    box.animate([{ transform: 'none', opacity: 1, borderRadius: '14px' }, { transform: small, opacity: 0, borderRadius: '50%' }], { duration: 380, easing: 'cubic-bezier(.6,0,.8,.3)', fill: 'both' }).finished.then(finish, finish);
  };

  const onClick = (ev) => {
    const t = ev.target;
    if (t.closest?.('#hub-map')) return openMap();
    const node = t.closest?.('.ring .node[data-id]');
    if (node) return openFamily(node.dataset.id, node);
    if (t.id === 'map-close' || t.classList?.contains('map-pop-back')) return closeMap();
    const nav = t.closest?.('[data-open]');
    if (nav) {
      if (nav.dataset.open === 'map') openMap();
      else openTab(nav.dataset.open);
    } else if (t.id === 'close') close();
    else if (t.dataset?.tab) openTab(t.dataset.tab);
  };
  const onKey = (ev) => {
    if (ev.key !== 'Escape') return;
    if (pop) closeMap();
    else if (current) close();
  };
  root.addEventListener('click', onClick);
  globalThis.addEventListener?.('keydown', onKey);

  function setStatus(s) {
    q('#status-text').textContent = STATUS_LABEL[s] ?? s;
    q('#status-light').className = `light ${STATUS_LIGHT[s] ?? 'local'}`;
  }
  setStatus('connecting');

  return {
    setStatus,
    hub: q('#hub'),
    unmount() {
      closeMap();
      close();
      unmounts.forEach((u) => u());
      root.removeEventListener('click', onClick);
      globalThis.removeEventListener?.('keydown', onKey);
      root.innerHTML = '';
    },
  };
}
