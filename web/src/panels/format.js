const TIME = new Intl.DateTimeFormat('fr-CH', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'Europe/Zurich',
});

const DATE = new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich' });

/** "14.11.2026 10:00:05" (Swiss time), or dashes when the value is not a finite number. */
export function formatDateTime(ms) {
  return Number.isFinite(ms) ? `${DATE.format(ms)} ${TIME.format(ms)}` : '--.--.---- --:--:--';
}

export function formatTime(ms) {
  return Number.isFinite(ms) ? TIME.format(ms) : '--:--:--';
}

/** Skew in ms -> "+30.0 s"; empty when under one second or unknown. */
export function formatSkew(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || Math.abs(ms) < 1000) return '';
  return `${ms > 0 ? '+' : '-'}${(Math.abs(ms) / 1000).toFixed(1)} s`;
}

export function formatOffset(ms) {
  return typeof ms === 'number' && Number.isFinite(ms) ? `${ms >= 0 ? '+' : '-'}${(Math.abs(ms) / 1000).toFixed(1)} s` : '—';
}

export function formatCapital(n) {
  return Number.isFinite(n) ? new Intl.NumberFormat('fr-CH').format(n) : '—';
}

/** Patrón name derived from the family id ("don-freey" -> "Don Freey"); the contract has no such field. */
export function donName(id) {
  return String(id ?? '')
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toLocaleUpperCase('fr-CH') + w.slice(1))
    .join(' ');
}
