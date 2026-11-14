/** Who claims which postcode. Stub families (empty zone) are ignored. */
export function buildTerritory({ npa, families }) {
  const owners = new Map();
  const unknownMap = new Map();
  const stats = new Map();

  for (const f of families) {
    if (!f.zone?.length) continue;
    stats.set(f.id, { zones: f.zone.length, onMap: 0, contested: 0, unknown: 0 });
    for (const plz of f.zone) {
      const target = plz in npa.npa ? owners : unknownMap;
      if (!target.has(plz)) target.set(plz, []);
      target.get(plz).push(f.id);
    }
  }
  for (const list of [...owners.values(), ...unknownMap.values()]) list.sort();

  const contested = [...owners].filter(([, ids]) => ids.length > 1).map(([plz]) => plz).sort();
  const unknown = [...unknownMap].map(([plz, ids]) => ({ plz, owners: ids })).sort((a, b) => (a.plz < b.plz ? -1 : 1));

  for (const [, ids] of owners) {
    for (const id of ids) {
      const s = stats.get(id);
      s.onMap++;
      if (ids.length > 1) s.contested++;
    }
  }
  for (const { owners: ids } of unknown) for (const id of ids) stats.get(id).unknown++;

  return { owners, contested, unknown, stats };
}
