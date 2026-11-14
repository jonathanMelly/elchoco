const raf = (cb) => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(cb) : setTimeout(cb, 16));
const caf = (id) => (globalThis.cancelAnimationFrame ? globalThis.cancelAnimationFrame(id) : clearTimeout(id));

/**
 * Renders view(select(ctx)) into el and re-renders on store/options changes,
 * at most once per frame. Returns an unmount function.
 */
export function mountReactive(el, ctx, { select, view, intervalMs = 0 }) {
  let frame = 0;
  let stopped = false;
  const render = () => {
    frame = 0;
    if (!stopped) el.innerHTML = view(select(ctx));
  };
  const schedule = () => {
    if (!frame && !stopped) frame = raf(render);
  };
  render();
  const offs = [ctx.store.subscribe(schedule), ctx.options.subscribe(schedule)];
  const timer = intervalMs ? setInterval(schedule, intervalMs) : null;
  return () => {
    stopped = true;
    offs.forEach((off) => off());
    if (timer) clearInterval(timer);
    if (frame) caf(frame);
  };
}
