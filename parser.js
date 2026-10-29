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

  function parseTranscript(text, now = new Date()) {
    const chunks = text
      .replace(/\b(also|and then|then|after that|plus)\b,?/gi, '.')
      .split(/[.;!?\n]+|,\s*(?=(?:i need to|need to|remember to|don't forget to)\b)/i)
      .map(s => s.trim()).filter(s => s.split(/\s+/).length >= 2);
    return chunks.map((raw, i) => {
      const tags = Object.keys(TAG_RULES).filter(k => TAG_RULES[k].test(raw));
      (raw.match(/#(\w+)/g) || []).forEach(h => tags.push(h.slice(1).toLowerCase()));
      const priority = /\b(urgent|asap|important|critical)\b/i.test(raw) ? 'high' : 'normal';
      const { due, match } = parseDue(raw, now);
      let title = raw.replace(match || /^$/, '')
        .replace(/#\w+/g, '')
        .replace(/^((ok(ay)?|so|um+|uh+|well)\b,?\s*)+/i, '')
        .replace(/^(i (need|have|want) to|i've got to|i gotta|need to|remember to|don't forget to|make sure to|i should|we should)\s+/i, '')
        .replace(/,?\s*(it's |this is )?(urgent(ly)?|asap|important)\b,?/gi, '').replace(/\s+,/g, ',')
        .replace(/\s{2,}/g, ' ').replace(/[\s,]+$/,'').trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      return { id: i + 1, title, due, tags: [...new Set(tags)], priority, done: false };
    }).filter(t => t.title.length > 1);
  }
  const api = { parseTranscript, parseDue };
  if (typeof module !== 'undefined') module.exports = api; else root.VNT = api;
})(this);
