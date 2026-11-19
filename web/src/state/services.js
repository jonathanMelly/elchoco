// Infrastructure services (time, registry, dispatch, web-order…) publish a presence like a family
// does, but never a vitrine. Since contract v2 a presence says what it is: `kind: 'service'`.
// LEGACY: a v1 presence (degraded mode, retired 12.12.2026) has no `kind`, so the known ids below stand in
// for it. Delete `LEGACY_SERVICES` (keeping the placeholder cards if wanted) once v1 is retired.
export const LEGACY_SERVICES = [
  { id: 'time', label: 'Temps', role: "heure UTC de l'hôte" },
  { id: 'registry', label: 'Registry', role: 'annuaire des chocolateries' },
  { id: 'dispatch', label: 'Dispatch', role: 'répartition des commandes' },
];

const byLegacyId = new Map(LEGACY_SERVICES.map((s) => [s.id, s]));

export function createServices() {
  const seenById = new Map();
  const statsById = new Map(); // id -> latest figures shown on the card (never creates a service by itself)
  const row = (id) => ({ id, label: id, role: '', state: 'unknown', lastSeen: 0, ...byLegacyId.get(id), ...seenById.get(id), stats: statsById.get(id) ?? {} });
  return {
    /** Merge figures for a card; `receivedAt` (live messages only) also refreshes its last-seen time. */
    stat(id, patch, receivedAt) {
      statsById.set(id, { ...statsById.get(id), ...patch });
      if (receivedAt !== undefined && seenById.has(id)) seenById.get(id).lastSeen = receivedAt;
    },
    /** presence → state; any other sign of life only refreshes lastSeen. */
    seen(id, receivedAt, state) {
      const prev = seenById.get(id);
      seenById.set(id, { id, state: state ?? prev?.state ?? 'open', lastSeen: receivedAt });
    },
    /** Already known as a service: announced `kind: 'service'` earlier, or a legacy id. */
    has: (id) => seenById.has(id) || byLegacyId.has(id),
    /** Known placeholders first (so they show "en attente"), then every other announced service. */
    list() {
      const rows = LEGACY_SERVICES.map((s) => row(s.id));
      for (const id of seenById.keys()) if (!byLegacyId.has(id)) rows.push(row(id));
      return rows;
    },
    /** Only the services actually heard from (no placeholder): what the Services tab shows. */
    received: () => [...seenById.keys()].map(row),
  };
}
