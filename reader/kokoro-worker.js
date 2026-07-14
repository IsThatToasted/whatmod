import { KokoroTTS } from "./vendor/kokoro.web.js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const MODEL_OPTIONS = Object.freeze({ dtype: "q8", device: "wasm" });

let tts = null;
let loadingPromise = null;
let generationQueue = Promise.resolve();

function send(message, transfer = []) {
  self.postMessage(message, transfer);
}

function normalizeProgress(progress = {}) {
  const loaded = Number(progress.loaded) || 0;
  const total = Number(progress.total) || 0;
  return {
    status: progress.status || "loading",
    file: progress.file || progress.name || "",
    progress: Number.isFinite(Number(progress.progress)) ? Number(progress.progress) : (total ? (loaded / total) * 100 : 0),
    loaded,
    total
  };
}

function queueGeneration(task) {
  const queued = generationQueue.then(task, task);
  generationQueue = queued.catch(() => {});
  return queued;
}

async function ensureModel() {
  if (tts) return tts;
  if (loadingPromise) return loadingPromise;

  loadingPromise = KokoroTTS.from_pretrained(MODEL_ID, {
    ...MODEL_OPTIONS,
    progress_callback: progress => send({ type: "model-progress", ...normalizeProgress(progress) })
  }).then(model => {
    tts = model;
    send({ type: "model-ready", model: MODEL_ID, dtype: MODEL_OPTIONS.dtype, device: MODEL_OPTIONS.device });
    return model;
  }).catch(error => {
    loadingPromise = null;
    throw error;
  });

  return loadingPromise;
}

self.addEventListener("message", async event => {
  const message = event.data || {};

  try {
    if (message.type === "init") {
      await ensureModel();
      send({ type: "response", id: message.id, ok: true, result: { ready: true } });
      return;
    }

    if (message.type === "generate") {
      const model = await ensureModel();
      const audio = await queueGeneration(() => model.generate(String(message.text || ""), {
        voice: message.voice || "bf_emma",
        speed: Math.max(0.5, Math.min(2, Number(message.speed) || 1))
      }));

      const samples = audio.audio instanceof Float32Array ? audio.audio.slice() : new Float32Array(audio.audio);
      send({
        type: "response",
        id: message.id,
        ok: true,
        result: {
          samples: samples.buffer,
          samplingRate: audio.sampling_rate || 24000
        }
      }, [samples.buffer]);
      return;
    }

    send({ type: "response", id: message.id, ok: false, error: "Unknown worker request." });
  } catch (error) {
    send({
      type: "response",
      id: message.id,
      ok: false,
      error: error?.message || String(error)
    });
  }
});
