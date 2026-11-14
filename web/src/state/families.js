const VITRINE_FIELDS = ['name', 'zone', 'capital', 'capitalCity', 'cacao', 'bestProduct'];

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createFamilies() {
  const byId = new Map();
  const listeners = new Set();

  const stub = (id, receivedAt) => ({
    id,
    name: id,
    zone: [],
    capital: 0,
    capitalCity: '',
    cacao: [],
    bestProduct: '',
    state: 'unknown',
    lastSeen: receivedAt,
  });

  function apply(kind, id, value, receivedAt) {
    const previous = byId.get(id);
    const next = previous ? { ...previous } : stub(id, receivedAt);
    next.lastSeen = receivedAt;

    if (kind === 'vitrine') {
      for (const k of VITRINE_FIELDS) next[k] = Array.isArray(value[k]) ? [...value[k]] : value[k];
    } else if (kind === 'presence') {
      next.state = value.state;
    } else {
      return false;
    }

    const changed =
      !previous ||
      next.state !== previous.state ||
      VITRINE_FIELDS.some((k) => !sameValue(next[k], previous[k]));

    byId.set(id, next);
    if (!changed) return false;

    const frozen = Object.freeze({ ...next });
    const prevFrozen = previous ? Object.freeze({ ...previous }) : undefined;
    for (const fn of [...listeners]) fn(frozen, prevFrozen);
    return true;
  }

  function touch(id, receivedAt) {
    const f = byId.get(id);
    if (f) f.lastSeen = receivedAt;
  }

  return {
    apply,
    touch,
    list: () => [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((f) => ({ ...f })),
    get: (id) => (byId.has(id) ? { ...byId.get(id) } : undefined),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
