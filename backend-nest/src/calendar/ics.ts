// Builds iCalendar (RFC 5545) feeds that calendar apps subscribe to.
// Times are written in UTC, so no VTIMEZONE definitions are needed.

export interface IcsEvent {
  uid: string;
  // YYYY-MM-DD and HH:MM (or '') as stored, in the band's time zone
  date: string;
  time: string;
  endTime: string;
  summary: string;
  description?: string;
  location?: string | null;
  categories?: string;
  url?: string;
}

export interface IcsCalendar {
  name: string;
  timeZone: string;
  // Used for events that have a start time but no end
  defaultEventMinutes: number;
  events: IcsEvent[];
  now?: Date;
}

const MINUTE = 60 * 1000;

// How far the zone is ahead of UTC at the given instant, in ms
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClock = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return wallClock - Math.floor(instant / 1000) * 1000;
}

// The instant a wall-clock time in the zone happens. Times skipped by a daylight saving
// jump land just after it; repeated ones pick the first.
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wallClock - zoneOffset(wallClock, timeZone);
  const offset = zoneOffset(firstGuess, timeZone);
  return new Date(wallClock - offset);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function formatUtc(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatDate(date: string): string {
  return date.replace(/-/g, '');
}

export function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// Lines longer than 75 octets continue on the next line after a space, never splitting a character
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const pieces: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const bytes = Buffer.byteLength(char, 'utf8');
    // Continuation lines start with a space, which counts toward their 75
    const limit = pieces.length === 0 ? 75 : 74;
    if (currentBytes + bytes > limit) {
      pieces.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  pieces.push(current);
  return pieces.join('\r\n ');
}

// DTSTART/DTEND lines: a whole day when there is no time, otherwise a span in UTC.
// An end earlier than the start (a show from 22:00 to 02:00) is on the next day.
function eventTimes(event: IcsEvent, calendar: IcsCalendar): string[] {
  if (!event.time) {
    return [`DTSTART;VALUE=DATE:${formatDate(event.date)}`, `DTEND;VALUE=DATE:${formatDate(addDays(event.date, 1))}`];
  }

  const start = zonedTimeToUtc(event.date, event.time, calendar.timeZone);
  let end: Date;
  if (event.endTime) {
    const endDate = event.endTime <= event.time ? addDays(event.date, 1) : event.date;
    end = zonedTimeToUtc(endDate, event.endTime, calendar.timeZone);
  } else {
    end = new Date(start.getTime() + calendar.defaultEventMinutes * MINUTE);
  }
  return [`DTSTART:${formatUtc(start)}`, `DTEND:${formatUtc(end)}`];
}

export function buildCalendar(calendar: IcsCalendar): string {
  const stamp = formatUtc(calendar.now ?? new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//minhabanda.com//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `X-WR-TIMEZONE:${calendar.timeZone}`,
    // Hints only: Google Calendar ignores them and refreshes on its own schedule
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const event of calendar.events) {
    lines.push('BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${stamp}`, ...eventTimes(event, calendar));
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.categories) lines.push(`CATEGORIES:${escapeText(event.categories)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
