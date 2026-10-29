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
      const device = (typeof navigator !== 'undefined' && navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null)) ? 'webgpu' : 'wasm';
      onProgress({ stage: 'lib', text: `Preparing Whisper (${device})…` });
      return pipeline('automatic-speech-recognition', MODEL, {
        dtype: device === 'webgpu' ? 'fp32' : 'q8', device,
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
// Decodes at the native rate (Safari ignores/rejects the sampleRate option), down-mixes all channels,
// then resamples with OfflineAudioContext.
export const MAX_BYTES = 100e6;
async function decode(file) {
  if (file.size > MAX_BYTES) throw new Error(`file is ${(file.size / 1e6).toFixed(0)} MB; max is ${MAX_BYTES / 1e6} MB`);
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Web Audio not supported in this browser');
  const ctx = new AC();
  let audio;
  try { audio = await new Promise((res, rej) => { const p = ctx.decodeAudioData(buf, res, rej); p && p.then && p.then(res, rej); }); }
  catch (e) { throw new Error('could not decode audio (unsupported format?)'); }
  finally { ctx.close && ctx.close(); }
  if (!audio || !audio.length) throw new Error('audio file is empty');
  const n = audio.numberOfChannels, mono = new Float32Array(audio.length);
  for (let c = 0; c < n; c++) { const d = audio.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / n; }
  if (audio.sampleRate === 16000) return mono;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const len = Math.ceil(audio.length * 16000 / audio.sampleRate), off = new OAC(1, len, 16000);
  const b = off.createBuffer(1, mono.length, audio.sampleRate); b.getChannelData(0).set(mono);
  const src = off.createBufferSource(); src.buffer = b; src.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0);
}

export async function transcribe(file, onProgress = () => {}) {
  const asr = await getPipe(onProgress);
  onProgress({ stage: 'decode', text: 'Decoding audio…' });
  const audio = await decode(file);
  onProgress({ stage: 'run', text: `Transcribing ${(audio.length / 16000).toFixed(0)} s of audio…` });
  if (audio.length < 1600) return '';
  const out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5 });
  return (out.text || '').trim();
}
