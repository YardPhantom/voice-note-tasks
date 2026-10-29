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
