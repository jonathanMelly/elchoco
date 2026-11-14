import { escapeHtml as e } from '../util/escape.js';

function select({ store, options }) {
  return { options: options.all(), familyIds: store.families.list().map((f) => ({ id: f.id, name: f.name })) };
}

const checkbox = (key, label, o) => `<label><input type="checkbox" data-key="${key}" ${o[key] ? 'checked' : ''}> ${label}</label>`;

function familyOptions(familyIds, current) {
  const ids = familyIds.some((f) => f.id === current) ? familyIds : [{ id: current, name: current }, ...familyIds];
  return ids.map((f) => `<option value="${e(f.id)}" ${f.id === current ? 'selected' : ''}>${e(f.name)} (${e(f.id)})</option>`).join('');
}

function view({ options: o, familyIds }) {
  return `<form class="options" onsubmit="return false">
<label>Volume <input type="range" min="0" max="1" step="0.05" data-key="volume" value="${e(o.volume)}"></label>
${checkbox('muted', 'Muet', o)}
<label>Effets <select data-key="effects">${['full', 'reduced', 'none']
    .map((v) => `<option value="${v}" ${o.effects === v ? 'selected' : ''}>${{ full: 'complets', reduced: 'réduits', none: 'aucun' }[v]}</option>`)
    .join('')}</select></label>
${checkbox('skipIntro', 'Passer l\'intro', o)}
<label>Ma famille <select data-key="myFamily">${familyOptions(familyIds, o.myFamily)}</select></label>
<label>Nom du Patrón <input type="text" data-key="patronName" value="${e(o.patronName)}"></label>
<label>Broker <input type="text" data-key="brokerUrl" value="${e(o.brokerUrl)}"></label>
${checkbox('music', 'Musique (chiptune)', o)}
${checkbox('humour', 'Humour', o)}
${checkbox('rawLog', 'Journal brut', o)}
</form>`;
}

/** Renders once; incoming messages never touch the inputs being edited. */
function mount(el, ctx) {
  el.innerHTML = view(select(ctx));
  const read = (target) => {
    const key = target.dataset?.key;
    if (!key) return;
    const value = target.type === 'checkbox' ? target.checked : target.type === 'range' ? Number(target.value) : target.value;
    ctx.options.set(key, value);
  };
  const onChange = (ev) => read(ev.target);
  // The family list is refreshed only when the select loses focus.
  const onFocusOut = (ev) => {
    if (ev.target.dataset?.key !== 'myFamily') return;
    ev.target.innerHTML = familyOptions(select(ctx).familyIds, ctx.options.get('myFamily'));
  };
  el.addEventListener('change', onChange);
  el.addEventListener('focusout', onFocusOut);
  return () => {
    el.removeEventListener('change', onChange);
    el.removeEventListener('focusout', onFocusOut);
  };
}

export default { id: 'options', title: 'Options', select, view, mount };
