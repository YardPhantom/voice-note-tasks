// Tasks -> iCalendar (.ics, RFC 5545). Pure function, no deps. Works in browser and Node.
(function (root) {
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  // Fold lines longer than 75 octets (approximated by chars) per RFC 5545 §3.1.
  const fold = l => { const out = []; while (l.length > 75) { out.push(l.slice(0, 75)); l = ' ' + l.slice(75); } out.push(l); return out.join('\r\n'); };
  const pad = n => String(n).padStart(2, '0');
  const stamp = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const nextDate = ymd => { const [y, m, d] = ymd.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + 1));
    return `${x.getUTCFullYear()}${pad(x.getUTCMonth()+1)}${pad(x.getUTCDate())}`; };

  /** Only tasks with a due date become events. Timed tasks are 30-min floating-time events; others are all-day. */
  function toICS(tasks, { now = new Date(), durationMin = 30, uidDomain = 'voice-note-tasks' } = {}) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trevor Heshka//Voice Note Tasks//EN', 'CALSCALE:GREGORIAN'];
    tasks.filter(t => t.due).forEach(t => {
      const date = t.due.replace(/-/g, '');
      lines.push('BEGIN:VEVENT', `UID:${t.id}-${date}-${String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}@${uidDomain}`, `DTSTAMP:${stamp(now)}`);
      if (t.time) {
        const [h, m] = t.time.split(':').map(Number); const end = h * 60 + m + durationMin;
        lines.push(`DTSTART:${date}T${pad(h)}${pad(m)}00`);
        lines.push(end < 1440 ? `DTEND:${date}T${pad(Math.floor(end / 60))}${pad(end % 60)}00` : `DURATION:PT${durationMin}M`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${nextDate(t.due)}`);
      }
      if (t.recurrence && t.recurrence.freq === 'WEEKLY')
        lines.push(`RRULE:FREQ=WEEKLY${t.recurrence.byday && t.recurrence.byday.length ? ';BYDAY=' + t.recurrence.byday.join(',') : ''}`);
      lines.push(`SUMMARY:${esc(t.title)}`);
      if (t.tags && t.tags.length) lines.push(`CATEGORIES:${t.tags.map(esc).join(',')}`);
      if (t.priority === 'high') lines.push('PRIORITY:1');
      if (t.done) lines.push('STATUS:CANCELLED');
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }
  const api = { toICS };
  if (typeof module !== 'undefined') module.exports = api; else root.VNTICS = api;
})(this);
