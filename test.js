const assert = require('assert'); const { parseTranscript } = require('./parser');
const now = new Date(2026, 9, 29); // Thu Oct 29 2026
const t = parseTranscript("Okay so I need to call the dentist tomorrow. Also buy milk and eggs. Finish the client report by Friday, it's urgent. Pay rent on November 1st #finance", now);
console.log(t);
assert.equal(t.length, 4);
assert.equal(t[0].due, '2026-10-30'); assert.ok(t[0].tags.includes('call'));
assert.equal(t[2].due, '2026-10-30'); assert.equal(t[2].priority, 'high');
assert.equal(t[3].due, '2026-11-01'); assert.ok(t[3].tags.includes('finance'));
console.log('ok');
assert.equal(t[0].title, 'Call the dentist'); assert.equal(t[2].title, 'Finish the client report');
assert.equal(parseTranscript('Then clean the garage next week', now)[0].due, '2026-11-05');

// --- multi-clause, time, recurrence ---
const { parseTime } = require('./parser');
const mc = parseTranscript('Call mom at 3pm and email Bob about the invoice tomorrow', now);
assert.equal(mc.length, 2);
assert.deepEqual([mc[0].title, mc[0].time, mc[0].due], ['Call mom', '15:00', '2026-10-29']);
assert.deepEqual([mc[1].title, mc[1].due], ['Email Bob about the invoice', '2026-10-30']);
assert.equal(parseTranscript('Buy milk and eggs', now).length, 1);
assert.equal(parseTime('at 3:30 pm').time, '15:30'); assert.equal(parseTime('at noon').time, '12:00');
assert.equal(parseTime('at 12am').time, '00:00'); assert.equal(parseTime('at 17:45').time, '17:45');
assert.equal(parseTime('buy 3 apples').time, null);
const rec = parseTranscript('Take out the trash every Tuesday and Friday at 7:30 am', now)[0];
assert.equal(rec.title, 'Take out the trash'); assert.equal(rec.time, '07:30');
assert.deepEqual(rec.recurrence, { freq: 'WEEKLY', byday: ['TU', 'FR'] }); assert.equal(rec.due, '2026-10-30');
const w = parseTranscript('Water the plants on Mondays', now)[0];
assert.deepEqual(w.recurrence.byday, ['MO']); assert.equal(w.due, '2026-11-02'); assert.equal(w.title, 'Water the plants');
assert.equal(parseTranscript('Go to the gym weekly', now)[0].recurrence.freq, 'WEEKLY');
assert.equal(t[1].time, null); assert.equal(t[1].recurrence, null);

// --- .ics export ---
const { toICS } = require('./ics');
const ics = toICS([...mc, rec, { id: 9, title: 'No date', due: null, tags: [] }, { ...t[2] }], { now: new Date(Date.UTC(2026, 9, 29, 12)) });
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 4);
assert.ok(ics.includes('DTSTART:20261029T150000\r\nDTEND:20261029T153000'));
assert.ok(ics.includes('DTSTART;VALUE=DATE:20261030\r\nDTEND;VALUE=DATE:20261031'));
assert.ok(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=TU,FR'));
assert.ok(ics.includes('PRIORITY:1')); assert.ok(!ics.includes('No date'));
assert.ok(toICS([{ id: 1, title: 'a, b; c', due: '2026-10-29', tags: [] }]).includes('SUMMARY:a\\, b\\; c'));
console.log('all tests ok');
