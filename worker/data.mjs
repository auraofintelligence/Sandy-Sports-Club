export const CLUB = {
  name: 'Sandy Sports Club',
  shortName: 'Sandy',
  location: 'Minjerribah / North Stradbroke Island, Queensland',
  timezone: 'Australia/Brisbane',
};

export const EVENTS = [];

export const PROGRAMME = [];

export const COMPETITION = null;

export const FEATURES = [
  { id: 'members', title: 'Member area and club calendar', status: 'available-with-membership-access' },
  { id: 'committee', title: 'Meeting notes and actions', status: 'available-with-committee-access' },
];

const utf8 = new TextEncoder();

export function escapeIcs(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

// RFC 5545 limits content lines to 75 octets, including continuation spaces.
export function foldIcsLine(value) {
  let line = '';
  let length = 0;
  const lines = [];
  for (const character of String(value)) {
    const size = utf8.encode(character).length;
    if (length + size > 75) {
      lines.push(line);
      line = ' ';
      length = 1;
    }
    line += character;
    length += size;
  }
  lines.push(line);
  return lines.join('\r\n');
}

function icsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function makeCalendar(events = EVENTS) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sandy Sports Club//Clubhouse//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Sandy Sports Club', 'X-WR-TIMEZONE:Australia/Brisbane'];
  for (const event of events) {
    const description = event.durationConfirmed === false
      ? `${event.description} The finish time is an estimate.`
      : event.description;
    lines.push('BEGIN:VEVENT', `UID:${escapeIcs(event.id)}@calendar.sandy-sports-club.invalid`, 'DTSTAMP:20261120T000000Z', `DTSTART:${icsDate(event.startsAt)}`, `DTEND:${icsDate(event.endsAt)}`, `SUMMARY:${escapeIcs(event.title)}`, `LOCATION:${escapeIcs(event.location)}`, `DESCRIPTION:${escapeIcs(description)}`, 'STATUS:CONFIRMED', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
