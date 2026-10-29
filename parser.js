// Transcript -> structured tasks. Pure function, no deps. Works in browser and Node.
(function (root) {
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const TAG_RULES = {
    work: /\b(meeting|client|report|email|deck|deadline|boss|project|invoice)\b/i,
    errand: /\b(buy|pick up|grocer|store|pharmacy|drop off|return)\b/i,
    call: /\b(call|phone|ring)\b/i,
    home: /\b(clean|laundry|dishes|fix|repair|garden|trash)\b/i,
    health: /\b(doctor|dentist|gym|workout|meds|appointment)\b/i,
    money: /\b(pay|bill|rent|tax|bank|budget)\b/i,
  };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

  function parseDue(text, now) {
    const t = text.toLowerCase(); let m;
    if (/\btoday|tonight\b/.test(t)) return { due: iso(now), match: /\b(today|tonight)\b/i };
    if (/\btomorrow\b/.test(t)) return { due: iso(add(now,1)), match: /\b(by |on )?tomorrow\b/i };
    if (/\bnext week\b/.test(t)) return { due: iso(add(now,7)), match: /\b(by )?next week\b/i };
    if ((m = t.match(/\bin (\d+) days?\b/))) return { due: iso(add(now,+m[1])), match: /\bin \d+ days?\b/i };
    if ((m = t.match(new RegExp(`\\b(${MONTHS.join('|')}) (\\d{1,2})(st|nd|rd|th)?\\b`)))) {
      let d = new Date(now.getFullYear(), MONTHS.indexOf(m[1]), +m[2]);
      if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear()+1);
      return { due: iso(d), match: new RegExp(`\\b(by |on )?${m[0]}\\b`, 'i') };
    }
    if ((m = t.match(new RegExp(`\\b(next )?(${DAYS.join('|')})\\b`)))) {
      let diff = (DAYS.indexOf(m[2]) - now.getDay() + 7) % 7 || 7;
      if (m[1]) diff += diff < 7 ? 7 : 0;
      return { due: iso(add(now,diff)), match: new RegExp(`\\b(by |on )?${m[0]}\\b`, 'i') };
    }
    return { due: null, match: null };
  }

  const DAY_ABBR = ['SU','MO','TU','WE','TH','FR','SA'];
  // Clock time: "at 3pm", "at 3:30 pm", "at 15:00", "at noon", "3pm". Returns "HH:MM".
  function parseTime(text) {
    let m;
    if ((m = text.match(/\b(?:at )?(noon|midday|midnight)\b/i)))
      return { time: /midnight/i.test(m[1]) ? '00:00' : '12:00', match: new RegExp(`\\b(at )?${m[1]}\\b`, 'i') };
    if ((m = text.match(/\b(at |by )?(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?(?=\W|$)/i))) {
      let h = +m[2] % 12; if (/p/i.test(m[4])) h += 12;
      if (+m[2] > 12 || +m[3] > 59) return { time: null, match: null };
      return { time: `${String(h).padStart(2,'0')}:${m[3] || '00'}`, match: m[0] };
    }
    if ((m = text.match(/\bat (\d{1,2}):(\d{2})\b/i)) && +m[1] < 24 && +m[2] < 60)
      return { time: `${m[1].padStart(2,'0')}:${m[2]}`, match: m[0] };
    return { time: null, match: null };
  }

  // Weekly recurrence: "every Monday", "every Tuesday and Thursday", "on Mondays", "weekly", "every week".
  function parseRecurrence(text, now) {
    const t = text.toLowerCase(); let m;
    const dayRe = DAYS.join('|');
    if ((m = t.match(new RegExp(`\\b(?:every|each) ((?:(?:${dayRe})(?:,? (?:and )?)?)+)`)))) {
      const days = [...new Set(m[1].match(new RegExp(dayRe, 'g')))];
      return { recurrence: { freq: 'WEEKLY', byday: days.map(d => DAY_ABBR[DAYS.indexOf(d)]) },
        match: new RegExp(m[0].trim().replace(/,$/, ''), 'i'), days };
    }
    if ((m = t.match(new RegExp(`\\bon (${dayRe})s\\b`))))
      return { recurrence: { freq: 'WEEKLY', byday: [DAY_ABBR[DAYS.indexOf(m[1])]] }, match: new RegExp(m[0], 'i'), days: [m[1]] };
    if ((m = t.match(/\b(weekly|every week|once a week)\b/)))
      return { recurrence: { freq: 'WEEKLY', byday: [DAY_ABBR[now.getDay()]] }, match: new RegExp(`\\b${m[0]}\\b`, 'i'), days: [] };
    return { recurrence: null, match: null, days: [] };
  }
  const nextDay = (name, now) => iso(add(now, (DAYS.indexOf(name) - now.getDay() + 7) % 7));

  // Split "call mom and email Bob" into two tasks, but keep "buy milk and eggs" together:
  // only split on "and"/"," when the next word is an action verb.
  const VERBS = 'call|phone|ring|text|email|e-mail|message|buy|get|pick up|drop off|return|pay|book|schedule|send|finish|write|clean|fix|repair|water|walk|feed|take out|do|check|review|submit|order|cancel|renew|wash|go to|visit|meet|remind|prepare|print|sign|update|file|mail|ship|clean up|vacuum|mow|cook';
  const CLAUSE_SPLIT = new RegExp(`\\s*(?:,\\s*(?:and\\s+)?|\\s+and\\s+)(?=(?:also\\s+|then\\s+)?(?:${VERBS})\\b)`, 'i');

  function parseTranscript(text, now = new Date()) {
    const chunks = text
      .replace(/\b(also|and then|then|after that|plus)\b,?/gi, '.')
      .split(/[.;!?\n]+|,\s*(?=(?:i need to|need to|remember to|don't forget to)\b)/i)
      .flatMap(s => s.split(CLAUSE_SPLIT))
      .map(s => s.trim()).filter(s => s.split(/\s+/).length >= 2);
    return chunks.map((raw, i) => {
      const tags = Object.keys(TAG_RULES).filter(k => TAG_RULES[k].test(raw));
      (raw.match(/#(\w+)/g) || []).forEach(h => tags.push(h.slice(1).toLowerCase()));
      const priority = /\b(urgent|asap|important|critical)\b/i.test(raw) ? 'high' : 'normal';
      const rec = parseRecurrence(raw, now);
      let rest = raw.replace(rec.match || /^$/, '');
      const tm = parseTime(rest);
      rest = rest.replace(tm.match || /^$/, '');
      let { due, match } = parseDue(rest, now);
      if (!due && rec.days.length) due = rec.days.map(d => nextDay(d, now)).sort()[0];
      if (!due && rec.recurrence) due = iso(now);
      if (!due && tm.time) due = iso(now);
      let title = rest.replace(match || /^$/, '')
        .replace(/#\w+/g, '')
        .replace(/^((ok(ay)?|so|um+|uh+|well)\b,?\s*)+/i, '')
        .replace(/^(i (need|have|want) to|i've got to|i gotta|need to|remember to|don't forget to|make sure to|i should|we should)\s+/i, '')
        .replace(/,?\s*(it's |this is )?(urgent(ly)?|asap|important)\b,?/gi, '').replace(/\s+,/g, ',')
        .replace(/\s{2,}/g, ' ').replace(/[\s,]+$/,'').trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      return { id: i + 1, title, due, time: tm.time, recurrence: rec.recurrence, tags: [...new Set(tags)], priority, done: false };
    }).filter(t => t.title.length > 1);
  }
  const api = { parseTranscript, parseDue, parseTime, parseRecurrence };
  if (typeof module !== 'undefined') module.exports = api; else root.VNT = api;
})(this);
