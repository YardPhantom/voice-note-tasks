// Optional offline transcription of uploaded audio with Whisper (transformers.js, whisper-tiny.en).
// Nothing here loads until the user clicks "Transcribe with Whisper": the library (~1 MB) comes from a CDN
// and the model (~40 MB quantized) is downloaded once and cached by the browser. The rest of the app never needs it.
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
const MODEL = 'Xenova/whisper-tiny.en';
let pipePromise = null;

export function isLoaded() { return pipePromise !== null; }

async function getPipe(onProgress) {
  if (!pipePromise) {
    pipePromise = (async () => {
      onProgress({ stage: 'lib', text: 'Loading transformers.js…' });
      const { pipeline } = await import(LIB);
      const files = {};
      return pipeline('automatic-speech-recognition', MODEL, {
        dtype: 'q8',
        progress_callback: p => {
          if (p.status === 'progress' && p.total) {
            files[p.file] = [p.loaded, p.total];
            const [l, t] = Object.values(files).reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
            onProgress({ stage: 'model', pct: Math.round(100 * l / t), text: `Downloading Whisper model… ${Math.round(100 * l / t)}% (${(l / 1e6).toFixed(1)} / ${(t / 1e6).toFixed(1)} MB)` });
          }
        },
      });
    })().catch(e => { pipePromise = null; throw e; });
  }
  return pipePromise;
}

// Decode any browser-supported audio file to 16 kHz mono Float32Array (what Whisper expects).
async function decode(file) {
  const buf = await file.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  try { const audio = await ctx.decodeAudioData(buf);
    if (audio.numberOfChannels === 1) return audio.getChannelData(0);
    const a = audio.getChannelData(0), b = audio.getChannelData(1), out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2; return out;
  } finally { ctx.close(); }
}

export async function transcribe(file, onProgress = () => {}) {
  const asr = await getPipe(onProgress);
  onProgress({ stage: 'decode', text: 'Decoding audio…' });
  const audio = await decode(file);
  onProgress({ stage: 'run', text: `Transcribing ${(audio.length / 16000).toFixed(0)} s of audio…` });
  const out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5 });
  return (out.text || '').trim();
}
