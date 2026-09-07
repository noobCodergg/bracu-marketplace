const DHAKA_TIME_ZONE = 'Asia/Dhaka';

function asDate(value: string | Date) {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+06:00`);
  return new Date(value);
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: DHAKA_TIME_ZONE,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('day')} ${part('month')}, ${part('year')}`;
}

export function formatTime(value?: string | Date | null) {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
    ? new Date(`2000-01-01T${value}:00+06:00`)
    : asDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: DHAKA_TIME_ZONE,
  }).format(date);
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—';
  return `${formatDate(value)} at ${formatTime(value)}`;
}

export function formatOrderSchedule(date?: string | null, time?: string | null) {
  return `${formatDate(date)} · ${formatTime(time)}`;
}
