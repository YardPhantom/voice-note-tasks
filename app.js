const $ = id => document.getElementById(id);
const DEMO = "Okay so I need to call the dentist tomorrow. Also buy milk and eggs. Finish the client report by Friday, it's urgent. Pay rent on November 1st #finance. Then clean the garage next week. Remember to email Sam about the project deck in 3 days. Call mom at 3pm and text Alex about dinner. Take out the trash every Tuesday at 7am.";
let tasks = JSON.parse(localStorage.getItem('vnt-tasks') || '[]');
const save = () => { localStorage.setItem('vnt-tasks', JSON.stringify(tasks)); render(); };
const status = s => $('status').textContent = s;

let lastDeleted = null, undoTimer = null;
function removeTask(t) {
  const idx = tasks.indexOf(t); if (idx < 0) return;
  tasks.splice(idx, 1); lastDeleted = { t, idx }; save();
  $('undomsg').textContent = `Deleted “${t.title}”.`; $('undo').hidden = false;
  clearTimeout(undoTimer); undoTimer = setTimeout(() => { $('undo').hidden = true; lastDeleted = null; }, 8000);
  const items = $('tasks').querySelectorAll('li.task'); (items[Math.min(idx, items.length - 1)] || $('transcript')).focus();
}
function undoDelete() {
  if (!lastDeleted) return; tasks.splice(lastDeleted.idx, 0, lastDeleted.t); const { idx } = lastDeleted;
  lastDeleted = null; $('undo').hidden = true; save(); status('Task restored.');
  const li = $('tasks').querySelectorAll('li.task')[idx]; li && li.focus();
}

function render() {
  $('tasks').innerHTML = ''; $('empty').hidden = tasks.length > 0;
  tasks.forEach((t, i) => {
    const li = document.createElement('li'); li.className = 'task' + (t.done ? ' done' : ''); li.tabIndex = -1;
    li.innerHTML = `<input type="checkbox" ${t.done ? 'checked' : ''}><span class="t" contenteditable role="textbox" aria-label="Task title"></span>
      ${t.priority === 'high' ? '<span class="chip high">high</span>' : ''}
      ${t.time ? `<span class="chip time">🕒 ${t.time}</span>` : ''}
      ${t.recurrence ? `<span class="chip rec" title="Repeats weekly">↻ ${(t.recurrence.byday || []).join('/') || 'weekly'}</span>` : ''}
      ${t.tags.map(g => `<span class="chip">#${g}</span>`).join('')}
      <input type="date" value="${t.due || ''}"><button class="ghost del" title="Delete">✕</button>`;
    const title = li.querySelector('.t'); title.textContent = t.title;
    li.querySelector('[type=checkbox]').setAttribute('aria-label', `Done: ${t.title}`);
    li.querySelector('[type=date]').setAttribute('aria-label', `Due date for ${t.title}`);
    li.querySelector('.del').setAttribute('aria-label', `Delete ${t.title}`);
    title.onblur = e => { const v = e.target.textContent.trim(); if (v && v !== t.title) { t.title = v; save(); } else e.target.textContent = t.title; };
    title.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); li.focus(); }
      if (e.key === 'Escape') { e.target.textContent = t.title; e.target.blur(); li.focus(); }
      e.stopPropagation();
    };
    li.querySelector('[type=checkbox]').onchange = e => { t.done = e.target.checked; save(); focusTask(i); status(`${t.title}: ${t.done ? 'done' : 'not done'}.`); };
    li.querySelector('[type=date]').onchange = e => { t.due = e.target.value || null; save(); };
    li.querySelector('.del').onclick = () => removeTask(t);
    li.onkeydown = e => {
      if (e.target !== li) return;
      const items = [...$('tasks').querySelectorAll('li.task')];
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); (items[i + 1] || li).focus(); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); (items[i - 1] || li).focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === ' ' || e.key === 'x') { e.preventDefault(); t.done = !t.done; save(); focusTask(i); status(`${t.title}: ${t.done ? 'done' : 'not done'}.`); }
      else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); title.focus(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeTask(t); }
    };
    $('tasks').appendChild(li);
  });
}
const focusTask = i => { const li = $('tasks').querySelectorAll('li.task')[i]; li && li.focus(); };
$('undobtn').onclick = undoDelete;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && lastDeleted && !e.target.closest('textarea,[contenteditable]')) { e.preventDefault(); undoDelete(); }
});

// Theme: follows the OS unless toggled; choice persisted.
const applyTheme = th => { if (th) document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme; };
applyTheme(localStorage.getItem('vnt-theme'));
$('theme').onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const next = cur === 'dark' ? 'light' : 'dark'; applyTheme(next); localStorage.setItem('vnt-theme', next); status(`${next[0].toUpperCase() + next.slice(1)} mode.`);
};

// Browser speech recognition (Chrome/Edge/Safari). Falls back to paste/demo mode.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec, recorder, chunks = [];
$('rec').onclick = async () => {
  if (rec) { rec.stop(); recorder && recorder.state !== 'inactive' && recorder.stop(); return; }
  if (!SR) { status('SpeechRecognition not supported here — paste a transcript or use the demo.'); return; }
  rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || 'en-US';
  const base = $('transcript').value ? $('transcript').value + ' ' : '';
  rec.onresult = e => { $('transcript').value = base + [...e.results].map(r => r[0].transcript).join(' '); };
  rec.onerror = e => status('Mic error: ' + e.error);
  rec.onend = () => { rec = null; $('rec').classList.remove('on'); $('rec').setAttribute('aria-pressed','false'); $('rec').textContent = '● Record'; status('Stopped.'); };
  try { // also keep the audio so it can be replayed
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream); chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); $('player').src = URL.createObjectURL(new Blob(chunks)); $('player').hidden = false; };
    recorder.start();
  } catch (_) {}
  rec.start(); $('rec').classList.add('on'); $('rec').setAttribute('aria-pressed','true'); $('rec').textContent = '■ Stop'; status('Listening…');
};

// Uploaded audio: play it; optionally transcribe offline with Whisper (lazy-loaded, see whisper.js).
let upload = null;
$('file').onchange = e => {
  const f = e.target.files[0]; if (!f) return; upload = f;
  $('player').src = URL.createObjectURL(f); $('player').hidden = false; $('whisper').hidden = false;
  status(`Loaded ${f.name}. Click ✨ Transcribe with Whisper (one-time ~40 MB download), or paste its transcript.`);
};
$('whisper').onclick = async () => {
  if (!upload) return;
  const btn = $('whisper'), box = $('wbox'), prog = $('wprog'), txt = $('wtext');
  btn.disabled = true; box.hidden = false; prog.removeAttribute('value');
  const onProgress = p => { txt.textContent = p.text; if (p.stage !== "model") status(p.text); if (p.pct != null) prog.value = p.pct; else prog.removeAttribute('value'); };
  try {
    const mod = await import('./whisper.js');
    const text = await mod.transcribe(upload, onProgress);
    $('transcript').value = ($('transcript').value ? $('transcript').value + ' ' : '') + text;
    status(text ? 'Whisper transcript ready — review it, then Extract tasks.' : 'Whisper heard nothing in that file.');
    box.hidden = true;
  } catch (err) {
    txt.textContent = 'Whisper unavailable (offline or blocked?): ' + (err.message || err) + ' — paste the transcript instead.';
    prog.value = 0;
  } finally { btn.disabled = false; }
};
$('demo').onclick = () => { $('transcript').value = DEMO; status('Demo transcript loaded.'); };
$('parse').onclick = () => {
  const found = VNT.parseTranscript($('transcript').value);
  const start = tasks.reduce((m, t) => Math.max(m, t.id), 0);
  tasks = tasks.concat(found.map((t, i) => ({ ...t, id: start + i + 1 }))); save();
  status(`${found.length} task(s) extracted.`);
};
$('clear').onclick = () => { if (tasks.length && !confirm(`Clear all ${tasks.length} task(s)?`)) return; tasks = []; save(); status('Checklist cleared.'); };
// Share: link that pre-fills the transcript via ?t= (stays client-side; nothing is uploaded).
const shareURL = text => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('t', text); return u.toString(); };
$('share').onclick = () => {
  const text = $('transcript').value.trim(); if (!text) { status('Nothing to share — add a transcript first.'); return; }
  const url = shareURL(text);
  if (url.length > 8000) { status('Transcript too long to share as a link (~8 KB max).'); return; }
  const done = () => status('Share link copied.');
  (navigator.share && matchMedia('(pointer: coarse)').matches ? navigator.share({ title: 'Voice Note Tasks', url }) : navigator.clipboard.writeText(url)).then(done, () => { history.replaceState(null, '', url); status('Link is in the address bar — copy it from there.'); });
};
$('copy').onclick = () => {
  const md = tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}${t.due ? ` (due ${t.due}${t.time ? ' ' + t.time : ''})` : ''}${t.recurrence ? ' (weekly)' : ''}${t.tags.map(g => ' #' + g).join('')}`).join('\n');
  navigator.clipboard.writeText(md).then(() => status('Copied Markdown.'));
};
$('ics').onclick = () => {
  const n = tasks.filter(t => t.due).length;
  if (!n) { status('No tasks with a due date to export.'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([VNTICS.toICS(tasks)], { type: 'text/calendar' }));
  a.download = 'tasks.ics'; a.click(); status(`Exported ${n} event(s) to tasks.ics.`);
};
$('json').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' }));
  a.download = 'tasks.json'; a.click();
};
const qs = new URLSearchParams(location.search);
if (qs.get('t')) { $('transcript').value = qs.get('t').slice(0, 5000); status('Transcript loaded from link — review it, then Extract tasks.'); if (qs.has('auto')) $('parse').click(); }
else if (qs.has('demo')) { $('demo').click(); if (!tasks.length) $('parse').click(); }
render();
