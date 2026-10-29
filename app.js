const $ = id => document.getElementById(id);
const DEMO = "Okay so I need to call the dentist tomorrow. Also buy milk and eggs. Finish the client report by Friday, it's urgent. Pay rent on November 1st #finance. Then clean the garage next week. Remember to email Sam about the project deck in 3 days.";
let tasks = JSON.parse(localStorage.getItem('vnt-tasks') || '[]');
const save = () => { localStorage.setItem('vnt-tasks', JSON.stringify(tasks)); render(); };
const status = s => $('status').textContent = s;

function render() {
  $('tasks').innerHTML = ''; $('empty').hidden = tasks.length > 0;
  tasks.forEach(t => {
    const li = document.createElement('li'); if (t.done) li.className = 'done';
    li.innerHTML = `<input type="checkbox" ${t.done ? 'checked' : ''}><span class="t" contenteditable></span>
      ${t.priority === 'high' ? '<span class="chip high">high</span>' : ''}
      ${t.tags.map(g => `<span class="chip">#${g}</span>`).join('')}
      <input type="date" value="${t.due || ''}"><button class="ghost" title="Delete">✕</button>`;
    li.querySelector('.t').textContent = t.title;
    li.querySelector('.t').onblur = e => { t.title = e.target.textContent.trim(); save(); };
    li.querySelector('[type=checkbox]').onchange = e => { t.done = e.target.checked; save(); };
    li.querySelector('[type=date]').onchange = e => { t.due = e.target.value || null; save(); };
    li.querySelector('button').onclick = () => { tasks = tasks.filter(x => x !== t); save(); };
    $('tasks').appendChild(li);
  });
}

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
  rec.onend = () => { rec = null; $('rec').classList.remove('on'); $('rec').textContent = '● Record'; status('Stopped.'); };
  try { // also keep the audio so it can be replayed
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream); chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); $('player').src = URL.createObjectURL(new Blob(chunks)); $('player').hidden = false; };
    recorder.start();
  } catch (_) {}
  rec.start(); $('rec').classList.add('on'); $('rec').textContent = '■ Stop'; status('Listening…');
};

// Uploaded audio: browsers can't transcribe a file offline without a model, so play it
// and let the user dictate/paste. (See README for an optional Whisper route.)
$('file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  $('player').src = URL.createObjectURL(f); $('player').hidden = false;
  status(`Loaded ${f.name}. Play it and press Record (speaker → mic), or paste its transcript.`);
};
$('demo').onclick = () => { $('transcript').value = DEMO; status('Demo transcript loaded.'); };
$('parse').onclick = () => {
  const found = VNT.parseTranscript($('transcript').value);
  const start = tasks.reduce((m, t) => Math.max(m, t.id), 0);
  tasks = tasks.concat(found.map((t, i) => ({ ...t, id: start + i + 1 }))); save();
  status(`${found.length} task(s) extracted.`);
};
$('clear').onclick = () => { tasks = []; save(); };
$('copy').onclick = () => {
  const md = tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}${t.due ? ` (due ${t.due})` : ''}${t.tags.map(g => ' #' + g).join('')}`).join('\n');
  navigator.clipboard.writeText(md).then(() => status('Copied Markdown.'));
};
$('json').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' }));
  a.download = 'tasks.json'; a.click();
};
if (new URLSearchParams(location.search).has('demo')) { $('demo').click(); if (!tasks.length) $('parse').click(); }
render();
