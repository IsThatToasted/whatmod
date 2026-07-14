(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const refs = {
    html: document.documentElement,
    homeButton: $("#homeButton"),
    themeButton: $("#themeButton"),
    libraryButton: $("#libraryButton"),
    saveState: $("#saveState"),
    title: $("#documentTitle"),
    meta: $("#documentMeta"),
    text: $("#textInput"),
    editorWrap: $("#editorWrap"),
    readerWrap: $("#readerWrap"),
    readerText: $("#readerText"),
    readerPosition: $("#readerPosition"),
    editButton: $("#editButton"),
    importButton: $("#importButton"),
    fileInput: $("#fileInput"),
    moreButton: $("#moreButton"),
    documentMenu: $("#documentMenu"),
    sampleButton: $("#sampleButton"),
    downloadButton: $("#downloadButton"),
    newDocumentButton: $("#newDocumentButton"),
    cursorStart: $("#cursorStart"),
    readButton: $("#readButton"),
    voiceButton: $("#voiceButton"),
    voiceAvatar: $("#voiceAvatar"),
    voiceLabel: $("#voiceLabel"),
    drawer: $("#voiceDrawer"),
    voiceSearch: $("#voiceSearch"),
    voiceList: $("#voiceList"),
    rate: $("#rateRange"),
    rateOutput: $("#rateOutput"),
    pitch: $("#pitchRange"),
    pitchOutput: $("#pitchOutput"),
    volume: $("#volumeRange"),
    volumeOutput: $("#volumeOutput"),
    previewVoiceButton: $("#previewVoiceButton"),
    kokoroEngineButton: $("#kokoroEngineButton"),
    browserEngineButton: $("#browserEngineButton"),
    modelStatus: $("#modelStatus"),
    modelStatusTitle: $("#modelStatusTitle"),
    modelStatusDetail: $("#modelStatusDetail"),
    modelProgress: $("#modelProgress"),
    modelProgressBar: $("#modelProgressBar"),
    voiceSettingNote: $("#voiceSettingNote"),
    pitchSetting: $("#pitchSetting"),
    libraryModal: $("#libraryModal"),
    libraryList: $("#libraryList"),
    closeLibraryButton: $("#closeLibraryButton"),
    libraryNewButton: $("#libraryNewButton"),
    player: $("#player"),
    playerProgressBar: $("#playerProgressBar"),
    playerScrubber: $("#playerScrubber"),
    playerTitle: $("#playerTitle"),
    playerStatus: $("#playerStatus"),
    playPauseButton: $("#playPauseButton"),
    previousButton: $("#previousButton"),
    nextButton: $("#nextButton"),
    elapsedLabel: $("#elapsedLabel"),
    durationLabel: $("#durationLabel"),
    playerVoiceButton: $("#playerVoiceButton"),
    stopButton: $("#stopButton"),
    sleepButton: $("#sleepButton"),
    sleepBadge: $("#sleepBadge"),
    sleepPopover: $("#sleepPopover"),
    toastRegion: $("#toastRegion")
  };

  const state = {
    db: null,
    currentDoc: null,
    voices: [],
    selectedVoiceURI: localStorage.getItem("voxleaf.voiceURI") || "",
    chunks: [],
    chunkIndex: 0,
    lastTextHash: "",
    speaking: false,
    paused: false,
    intentionalCancel: false,
    utterance: null,
    saveTimer: null,
    progressTimer: null,
    speechStartedAt: 0,
    elapsedBeforeStart: 0,
    sleepUntil: null,
    sleepTimerInterval: null,
    currentMode: "edit",
    selectedStartOffset: 0,
    engine: localStorage.getItem("voxleaf.engine") || "kokoro",
    selectedKokoroVoice: localStorage.getItem("voxleaf.kokoroVoice") || "bf_emma",
    kokoroWorker: null,
    kokoroPending: new Map(),
    kokoroRequestId: 0,
    kokoroInitPromise: null,
    kokoroReady: false,
    kokoroCache: new Map(),
    playbackToken: 0,
    audioContext: null,
    gainNode: null,
    kokoroSource: null,
    kokoroCurrentData: null,
    kokoroCurrentOffset: 0,
    kokoroStartedAt: 0,
    previewSource: null
  };

  const SAMPLE_TEXT = `The rain had been whispering against the library windows since dusk. Mara sat alone beneath the brass reading lamp, turning the final page of a book that had no title on its cover.

When she reached the last sentence, the room became completely still. Even the old clock above the fireplace seemed to hold its breath.

Then, from somewhere deep between the shelves, a voice softly read her name.`;

  const DB_NAME = "voxleaf-library";
  const DB_VERSION = 1;
  const DOC_STORE = "documents";
  const CURRENT_DOC_KEY = "voxleaf.currentDocId";
  const EPUB_SCRIPTS = [
    "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    "https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js"
  ];

  const KOKORO_VOICES = Object.freeze([
    { id: "bf_emma", name: "Emma", language: "British English", gender: "Female", description: "Warm, polished narration", grade: "B−" },
    { id: "bf_isabella", name: "Isabella", language: "British English", gender: "Female", description: "Bright and clear", grade: "C" },
    { id: "bf_alice", name: "Alice", language: "British English", gender: "Female", description: "Light and conversational", grade: "D" },
    { id: "bf_lily", name: "Lily", language: "British English", gender: "Female", description: "Gentle and relaxed", grade: "D" }
  ]);

  function uid() {
    return (crypto.randomUUID?.() || `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }

  function debounce(fn, delay = 450) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function toast(message, type = "info") {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    refs.toastRegion.append(node);
    setTimeout(() => node.remove(), 3600);
  }

  function setTheme(theme) {
    const resolved = theme === "dark" ? "dark" : "light";
    refs.html.dataset.theme = resolved;
    localStorage.setItem("voxleaf.theme", resolved);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = resolved === "dark" ? "#12101b" : "#6f5ae8";
  }

  function initializeTheme() {
    const saved = localStorage.getItem("voxleaf.theme");
    const preferred = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(saved || preferred);
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DOC_STORE)) {
          const store = db.createObjectStore(DOC_STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function dbRequest(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(DOC_STORE, mode);
      const store = tx.objectStore(DOC_STORE);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getDocument(id) {
    if (!id || !state.db) return null;
    return dbRequest("readonly", store => store.get(id));
  }

  async function getAllDocuments() {
    if (!state.db) return [];
    const docs = await dbRequest("readonly", store => store.getAll());
    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function putDocument(doc) {
    if (!state.db) return;
    return dbRequest("readwrite", store => store.put(doc));
  }

  async function deleteDocument(id) {
    if (!state.db) return;
    return dbRequest("readwrite", store => store.delete(id));
  }

  function makeDocument({ title = "Untitled reading", text = "", source = "manual" } = {}) {
    const now = Date.now();
    return {
      id: uid(),
      title,
      text,
      source,
      createdAt: now,
      updatedAt: now,
      progressIndex: 0,
      progressOffset: 0
    };
  }

  async function loadInitialDocument() {
    const currentId = localStorage.getItem(CURRENT_DOC_KEY);
    let doc = await getDocument(currentId);
    if (!doc) doc = makeDocument();
    await loadDocument(doc, { save: true, focus: false });
  }

  async function loadDocument(doc, { save = false, focus = true } = {}) {
    stopSpeech({ hidePlayer: true, preserveIndex: false });
    state.currentDoc = doc;
    localStorage.setItem(CURRENT_DOC_KEY, doc.id);
    refs.title.value = doc.title || "Untitled reading";
    refs.text.value = doc.text || "";
    state.chunkIndex = Number.isFinite(doc.progressIndex) ? doc.progressIndex : 0;
    state.selectedStartOffset = Number.isFinite(doc.progressOffset) ? doc.progressOffset : 0;
    state.lastTextHash = "";
    showEditor();
    updateDocumentStats();
    if (save) await saveCurrentDocument(true);
    if (focus) refs.text.focus();
  }

  async function saveCurrentDocument(immediate = false) {
    if (!state.currentDoc) return;
    clearTimeout(state.saveTimer);
    const execute = async () => {
      refs.saveState.textContent = "Saving…";
      state.currentDoc.title = refs.title.value.trim() || "Untitled reading";
      state.currentDoc.text = refs.text.value;
      state.currentDoc.updatedAt = Date.now();
      state.currentDoc.progressIndex = state.chunkIndex;
      state.currentDoc.progressOffset = state.chunks[state.chunkIndex]?.start || state.selectedStartOffset || 0;
      try {
        await putDocument(state.currentDoc);
        refs.saveState.textContent = "Saved locally";
      } catch (error) {
        console.error(error);
        refs.saveState.textContent = "Couldn’t save";
        toast("This browser could not save the reading locally.", "error");
      }
    };
    if (immediate) await execute();
    else state.saveTimer = setTimeout(execute, 650);
  }

  const scheduleSave = debounce(() => saveCurrentDocument(), 250);

  function wordCount(text) {
    return (text.trim().match(/[\p{L}\p{N}'’–-]+/gu) || []).length;
  }

  function estimateMinutes(text, rate = Number(refs.rate.value) || 1) {
    return wordCount(text) / (175 * rate);
  }

  function friendlyDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0.08) return "less than a minute";
    if (minutes < 1.5) return "about 1 minute";
    if (minutes < 60) return `about ${Math.round(minutes)} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins ? `about ${hours}h ${mins}m` : `about ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  function updateDocumentStats() {
    const count = wordCount(refs.text.value);
    refs.meta.textContent = `${count.toLocaleString()} word${count === 1 ? "" : "s"} · ${friendlyDuration(estimateMinutes(refs.text.value))}`;
  }

  function normalizeText(text) {
    return text
      .replace(/\r\n?/g, "\n")
      .replace(/[\t\f\v]+/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function splitLongSegment(segment, maxLength) {
    const parts = [];
    let remaining = segment.trim();
    while (remaining.length > maxLength) {
      let cut = remaining.lastIndexOf(", ", maxLength);
      if (cut < maxLength * 0.55) cut = remaining.lastIndexOf(" ", maxLength);
      if (cut < maxLength * 0.4) cut = maxLength;
      parts.push(remaining.slice(0, cut + (remaining[cut] === "," ? 1 : 0)).trim());
      remaining = remaining.slice(cut + 1).trim();
    }
    if (remaining) parts.push(remaining);
    return parts;
  }

  function buildChunks(rawText, maxLength = 230) {
    const text = normalizeText(rawText);
    if (!text) return [];
    const chunks = [];
    let searchOffset = 0;
    const paragraphs = text.split(/\n{2,}/);

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const sentences = paragraph.match(/[^.!?…]+(?:[.!?…]+[”’"']*|$)/g) || [paragraph];
      let buffer = "";
      const flush = () => {
        const trimmed = buffer.trim();
        if (!trimmed) return;
        const start = text.indexOf(trimmed, searchOffset);
        const safeStart = start >= 0 ? start : searchOffset;
        chunks.push({ text: trimmed, start: safeStart, end: safeStart + trimmed.length, paragraphIndex });
        searchOffset = safeStart + trimmed.length;
        buffer = "";
      };

      for (const sentenceRaw of sentences) {
        const sentence = sentenceRaw.trim();
        if (!sentence) continue;
        if (sentence.length > maxLength) {
          flush();
          splitLongSegment(sentence, maxLength).forEach(part => {
            const start = text.indexOf(part, searchOffset);
            const safeStart = start >= 0 ? start : searchOffset;
            chunks.push({ text: part, start: safeStart, end: safeStart + part.length, paragraphIndex });
            searchOffset = safeStart + part.length;
          });
        } else if (!buffer || `${buffer} ${sentence}`.length <= maxLength) {
          buffer = buffer ? `${buffer} ${sentence}` : sentence;
        } else {
          flush();
          buffer = sentence;
        }
      }
      flush();
    });
    return chunks;
  }

  function textHash(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += Math.max(1, Math.floor(text.length / 1500))) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${text.length}:${hash >>> 0}`;
  }

  function ensureChunks() {
    const normalized = normalizeText(refs.text.value);
    const hash = textHash(normalized);
    if (hash !== state.lastTextHash) {
      state.chunks = buildChunks(normalized);
      state.lastTextHash = hash;
      state.chunkIndex = Math.min(state.chunkIndex, Math.max(0, state.chunks.length - 1));
      renderReader();
    }
    return state.chunks;
  }

  function renderReader() {
    refs.readerText.replaceChildren();
    if (!state.chunks.length) return;
    const paragraphMap = new Map();
    state.chunks.forEach((chunk, index) => {
      if (!paragraphMap.has(chunk.paragraphIndex)) {
        const paragraph = document.createElement("span");
        paragraph.className = "paragraph";
        paragraphMap.set(chunk.paragraphIndex, paragraph);
        refs.readerText.append(paragraph);
      }
      const span = document.createElement("span");
      span.className = "chunk";
      span.dataset.index = index;
      span.textContent = `${chunk.text} `;
      span.addEventListener("click", () => jumpToChunk(index, state.speaking && !state.paused));
      paragraphMap.get(chunk.paragraphIndex).append(span);
    });
  }

  function showReader() {
    state.currentMode = "reader";
    refs.editorWrap.hidden = true;
    refs.readerWrap.hidden = false;
    highlightChunk();
  }

  function showEditor() {
    state.currentMode = "edit";
    refs.readerWrap.hidden = true;
    refs.editorWrap.hidden = false;
  }

  function findChunkAtOffset(offset) {
    const index = state.chunks.findIndex(chunk => offset >= chunk.start && offset < chunk.end);
    if (index >= 0) return index;
    const later = state.chunks.findIndex(chunk => chunk.start >= offset);
    return later >= 0 ? later : Math.max(0, state.chunks.length - 1);
  }

  function selectedBrowserVoice() {
    return state.voices.find(voice => voice.voiceURI === state.selectedVoiceURI) || state.voices[0] || null;
  }

  function selectedKokoroVoice() {
    return KOKORO_VOICES.find(voice => voice.id === state.selectedKokoroVoice) || KOKORO_VOICES[0];
  }

  function voiceDisplayName(voice) {
    if (!voice) return "Default system voice";
    return voice.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  }

  function bestDefaultVoice(voices) {
    const ukVoices = voices.filter(voice => /^en[-_]gb$/i.test(voice.lang || ""));
    const ukFemalePattern = /female|sonia|libby|hazel|susan|serena|kate|stephanie|emily|emma|isabella|lily|alice/i;
    const qualityPattern = /natural|enhanced|premium|neural|online/i;

    const rankedUkFemale = ukVoices
      .filter(voice => ukFemalePattern.test(voice.name))
      .sort((a, b) => {
        const qualityDifference = Number(qualityPattern.test(b.name)) - Number(qualityPattern.test(a.name));
        if (qualityDifference) return qualityDifference;
        const localDifference = Number(b.localService) - Number(a.localService);
        if (localDifference) return localDifference;
        return a.name.localeCompare(b.name);
      });

    if (rankedUkFemale.length) return rankedUkFemale[0];
    const preferredUk = ukVoices.find(voice => qualityPattern.test(voice.name)) || ukVoices.find(voice => voice.localService) || ukVoices[0];
    if (preferredUk) return preferredUk;

    const language = navigator.language || "en-US";
    const localSameLang = voices.filter(voice => voice.localService && voice.lang?.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
    const sameLang = voices.filter(voice => voice.lang?.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
    const preferredPattern = /aria|jenny|samantha|serena|google us english|natural|enhanced|premium|neural/i;
    return localSameLang.find(voice => preferredPattern.test(voice.name)) || sameLang.find(voice => preferredPattern.test(voice.name)) || localSameLang[0] || sameLang[0] || voices.find(voice => voice.localService) || voices[0];
  }

  function loadVoices() {
    if (!("speechSynthesis" in window)) {
      state.voices = [];
      updateVoiceUI();
      renderVoiceList();
      return;
    }
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;
    state.voices = [...voices].sort((a, b) => {
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
      return a.name.localeCompare(b.name);
    });
    if (!state.voices.some(voice => voice.voiceURI === state.selectedVoiceURI)) {
      state.selectedVoiceURI = bestDefaultVoice(state.voices)?.voiceURI || "";
    }
    updateVoiceUI();
    renderVoiceList();
  }

  function setModelStatus(kind, title, detail, progress = null) {
    refs.modelStatus.classList.remove("loading", "ready", "error");
    if (kind) refs.modelStatus.classList.add(kind);
    refs.modelStatusTitle.textContent = title;
    refs.modelStatusDetail.textContent = detail;
    const showProgress = Number.isFinite(progress);
    refs.modelProgress.hidden = !showProgress;
    if (showProgress) refs.modelProgressBar.style.width = `${Math.max(2, Math.min(100, progress))}%`;
  }

  function updateEngineUI() {
    const isKokoro = state.engine === "kokoro";
    refs.kokoroEngineButton.classList.toggle("selected", isKokoro);
    refs.browserEngineButton.classList.toggle("selected", !isKokoro);
    refs.kokoroEngineButton.setAttribute("aria-pressed", String(isKokoro));
    refs.browserEngineButton.setAttribute("aria-pressed", String(!isKokoro));
    refs.modelStatus.hidden = !isKokoro;
    refs.pitchSetting.classList.toggle("is-disabled", isKokoro);
    refs.pitch.disabled = isKokoro;
    refs.voiceSettingNote.textContent = isKokoro
      ? "AI narration is generated on this device after the model is downloaded. Your reading text is not sent to a speech API."
      : "Local voices stay on your device. Online voices may be processed by your browser or operating-system provider.";
    refs.voiceSearch.placeholder = isKokoro ? "Search AI voices" : "Search name or language";
  }

  function setEngine(engine) {
    const next = engine === "browser" ? "browser" : "kokoro";
    if (next === "browser" && !("speechSynthesis" in window)) {
      toast("Device voices are not supported in this browser. AI Narrator is still available.", "error");
      return;
    }
    const changed = state.engine !== next;
    state.engine = next;
    localStorage.setItem("voxleaf.engine", state.engine);
    updateEngineUI();
    updateVoiceUI();
    renderVoiceList();
    if (changed && state.speaking) restartCurrentChunk();
  }

  function updateVoiceUI() {
    if (state.engine === "kokoro") {
      const voice = selectedKokoroVoice();
      refs.voiceLabel.textContent = `${voice.name} · AI Narrator`;
      refs.voiceAvatar.textContent = voice.name.charAt(0).toUpperCase();
      localStorage.setItem("voxleaf.kokoroVoice", state.selectedKokoroVoice);
    } else {
      const voice = selectedBrowserVoice();
      refs.voiceLabel.textContent = voiceDisplayName(voice);
      refs.voiceAvatar.textContent = voiceDisplayName(voice).charAt(0).toUpperCase() || "V";
      localStorage.setItem("voxleaf.voiceURI", state.selectedVoiceURI);
    }
    updateEngineUI();
  }

  function renderVoiceList(filter = refs.voiceSearch.value.trim().toLowerCase()) {
    refs.voiceList.replaceChildren();

    if (state.engine === "kokoro") {
      const voices = KOKORO_VOICES.filter(voice => !filter || `${voice.name} ${voice.language} ${voice.description}`.toLowerCase().includes(filter));
      voices.forEach(voice => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `voice-option${voice.id === state.selectedKokoroVoice ? " selected" : ""}`;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(voice.id === state.selectedKokoroVoice));

        const avatar = document.createElement("span");
        avatar.className = "voice-avatar";
        avatar.textContent = voice.name.charAt(0);

        const copy = document.createElement("span");
        copy.className = "voice-option-copy";
        const strong = document.createElement("strong");
        strong.textContent = voice.name;
        const small = document.createElement("small");
        small.textContent = `${voice.language} · ${voice.description}`;
        copy.append(strong, small);

        const badge = document.createElement("span");
        badge.className = "voice-badge ai";
        badge.textContent = "AI";

        button.append(avatar, copy, badge);
        button.addEventListener("click", () => {
          state.selectedKokoroVoice = voice.id;
          state.kokoroCache.clear();
          updateVoiceUI();
          renderVoiceList();
          if (state.speaking) restartCurrentChunk();
        });
        refs.voiceList.append(button);
      });
      return;
    }

    const voices = state.voices.filter(voice => !filter || `${voice.name} ${voice.lang}`.toLowerCase().includes(filter));
    if (!voices.length) {
      const empty = document.createElement("p");
      empty.className = "setting-note";
      empty.textContent = state.voices.length ? "No voices match that search." : "No device voices are available in this browser.";
      refs.voiceList.append(empty);
      return;
    }

    voices.forEach(voice => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `voice-option${voice.voiceURI === state.selectedVoiceURI ? " selected" : ""}`;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(voice.voiceURI === state.selectedVoiceURI));

      const avatar = document.createElement("span");
      avatar.className = "voice-avatar";
      avatar.textContent = voiceDisplayName(voice).charAt(0).toUpperCase();

      const copy = document.createElement("span");
      copy.className = "voice-option-copy";
      const strong = document.createElement("strong");
      strong.textContent = voiceDisplayName(voice);
      const small = document.createElement("small");
      small.textContent = `${voice.lang || "Unknown language"}${voice.default ? " · System default" : ""}`;
      copy.append(strong, small);

      const badge = document.createElement("span");
      badge.className = `voice-badge${voice.localService ? " local" : ""}`;
      badge.textContent = voice.localService ? "Local" : "Online";

      button.append(avatar, copy, badge);
      button.addEventListener("click", () => {
        state.selectedVoiceURI = voice.voiceURI;
        updateVoiceUI();
        renderVoiceList();
        if (state.speaking) restartCurrentChunk();
      });
      refs.voiceList.append(button);
    });
  }

  async function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("This browser cannot play locally generated AI audio.");
    if (!state.audioContext) {
      state.audioContext = new AudioContextClass();
      state.gainNode = state.audioContext.createGain();
      state.gainNode.gain.value = Number(refs.volume.value);
      state.gainNode.connect(state.audioContext.destination);
    }
    if (state.audioContext.state === "suspended") await state.audioContext.resume();
    return state.audioContext;
  }

  function ensureKokoroWorker() {
    if (state.kokoroWorker) return state.kokoroWorker;
    if (!("Worker" in window)) throw new Error("This browser does not support the AI narration worker.");

    const worker = new Worker("./kokoro-worker.js", { type: "module" });
    worker.addEventListener("message", event => {
      const message = event.data || {};
      if (message.type === "model-progress") {
        const progress = Number(message.progress);
        const file = String(message.file || "AI model").split("/").pop();
        const status = String(message.status || "loading");
        if (["progress", "download", "initiate"].includes(status)) {
          setModelStatus("loading", "Downloading AI narrator…", file || "Preparing model files", Number.isFinite(progress) ? progress : 2);
        } else if (status === "done") {
          setModelStatus("loading", "Preparing AI narrator…", file || "Optimizing the model", 98);
        }
        return;
      }
      if (message.type === "model-ready") {
        state.kokoroReady = true;
        setModelStatus("ready", "AI narrator ready", "Kokoro is cached by your browser for future readings.");
        return;
      }
      if (message.type === "response") {
        const pending = state.kokoroPending.get(message.id);
        if (!pending) return;
        state.kokoroPending.delete(message.id);
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(message.error || "AI narrator request failed."));
      }
    });
    worker.addEventListener("error", event => {
      const error = new Error(event.message || "The AI narrator worker stopped.");
      state.kokoroPending.forEach(pending => pending.reject(error));
      state.kokoroPending.clear();
      state.kokoroInitPromise = null;
      state.kokoroReady = false;
      setModelStatus("error", "AI narrator unavailable", error.message);
    });
    state.kokoroWorker = worker;
    return worker;
  }

  function requestKokoro(type, payload = {}) {
    const worker = ensureKokoroWorker();
    const id = `kokoro-${++state.kokoroRequestId}`;
    return new Promise((resolve, reject) => {
      state.kokoroPending.set(id, { resolve, reject });
      worker.postMessage({ type, id, ...payload });
    });
  }

  async function ensureKokoroModel() {
    if (state.kokoroReady) return;
    if (state.kokoroInitPromise) return state.kokoroInitPromise;
    setModelStatus("loading", "Starting AI narrator…", "Checking the local model cache", 2);
    state.kokoroInitPromise = requestKokoro("init")
      .then(() => {
        state.kokoroReady = true;
        setModelStatus("ready", "AI narrator ready", "Kokoro is cached by your browser for future readings.");
      })
      .catch(error => {
        state.kokoroInitPromise = null;
        state.kokoroReady = false;
        setModelStatus("error", "AI narrator unavailable", error.message || "The model could not be loaded.");
        throw error;
      });
    return state.kokoroInitPromise;
  }

  function kokoroCacheKey(index) {
    const chunk = state.chunks[index];
    return chunk ? `${state.lastTextHash}:${index}:${state.selectedKokoroVoice}:${Number(refs.rate.value).toFixed(2)}` : "";
  }

  async function generateKokoroChunk(index) {
    const chunk = state.chunks[index];
    if (!chunk) throw new Error("No text chunk is available.");
    const key = kokoroCacheKey(index);
    if (state.kokoroCache.has(key)) return state.kokoroCache.get(key);

    const promise = (async () => {
      await ensureKokoroModel();
      const result = await requestKokoro("generate", {
        text: chunk.text,
        voice: state.selectedKokoroVoice,
        speed: Number(refs.rate.value)
      });
      return {
        samples: new Float32Array(result.samples),
        samplingRate: Number(result.samplingRate) || 24000
      };
    })();

    state.kokoroCache.set(key, promise);
    promise.catch(() => state.kokoroCache.delete(key));
    while (state.kokoroCache.size > 8) state.kokoroCache.delete(state.kokoroCache.keys().next().value);
    return promise;
  }

  function prefetchKokoro(index) {
    for (let offset = 1; offset <= 2; offset += 1) {
      if (index + offset < state.chunks.length) generateKokoroChunk(index + offset).catch(() => {});
    }
  }

  function stopPreview() {
    if (!state.previewSource) return;
    const source = state.previewSource;
    state.previewSource = null;
    try { source.stop(); } catch (_) { /* already stopped */ }
  }

  function stopKokoroSource(preserveOffset = false) {
    const source = state.kokoroSource;
    if (!source) return;
    if (preserveOffset && state.audioContext && state.kokoroCurrentData) {
      const elapsed = Math.max(0, state.audioContext.currentTime - state.kokoroStartedAt);
      const duration = state.kokoroCurrentData.samples.length / state.kokoroCurrentData.samplingRate;
      state.kokoroCurrentOffset = Math.min(duration, state.kokoroCurrentOffset + elapsed);
    }
    state.kokoroSource = null;
    try { source.stop(); } catch (_) { /* already stopped */ }
  }

  async function playKokoroData(data, token, offset = 0) {
    const context = await ensureAudioContext();
    if (token !== state.playbackToken || !state.speaking || state.paused) return;
    stopKokoroSource(false);

    const buffer = context.createBuffer(1, data.samples.length, data.samplingRate);
    buffer.copyToChannel(data.samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(state.gainNode);

    const safeOffset = offset >= buffer.duration ? 0 : Math.max(0, offset);
    state.kokoroSource = source;
    state.kokoroCurrentData = data;
    state.kokoroCurrentOffset = safeOffset;
    state.kokoroStartedAt = context.currentTime;

    source.addEventListener("ended", () => {
      if (state.kokoroSource !== source) return;
      state.kokoroSource = null;
      state.kokoroCurrentData = null;
      state.kokoroCurrentOffset = 0;
      if (token !== state.playbackToken || !state.speaking || state.paused) return;
      state.chunkIndex += 1;
      if (state.chunkIndex >= state.chunks.length) finishSpeech();
      else {
        saveCurrentDocument();
        speakCurrentChunk();
      }
    });

    source.start(0, safeOffset);
    if (!state.speechStartedAt) state.speechStartedAt = Date.now();
    const voice = selectedKokoroVoice();
    refs.playerStatus.textContent = `${voice.name} · AI Narrator`;
    highlightChunk(true);
    prefetchKokoro(state.chunkIndex);
  }

  async function speakPreview() {
    if (state.engine === "browser") {
      if (!("speechSynthesis" in window)) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("This is how your reading will sound in Voxleaf.");
      const voice = selectedBrowserVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = Number(refs.rate.value);
      utterance.pitch = Number(refs.pitch.value);
      utterance.volume = Number(refs.volume.value);
      speechSynthesis.speak(utterance);
      return;
    }

    const original = refs.previewVoiceButton.innerHTML;
    refs.previewVoiceButton.disabled = true;
    refs.previewVoiceButton.textContent = state.kokoroReady ? "Preparing preview…" : "Loading AI narrator…";
    try {
      const context = await ensureAudioContext();
      stopPreview();
      await ensureKokoroModel();
      const result = await requestKokoro("generate", {
        text: "The old house had been silent for years, until one winter evening when the music began.",
        voice: state.selectedKokoroVoice,
        speed: Number(refs.rate.value)
      });
      const samples = new Float32Array(result.samples);
      const samplingRate = Number(result.samplingRate) || 24000;
      const buffer = context.createBuffer(1, samples.length, samplingRate);
      buffer.copyToChannel(samples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(state.gainNode);
      source.addEventListener("ended", () => { if (state.previewSource === source) state.previewSource = null; });
      state.previewSource = source;
      source.start();
    } catch (error) {
      console.error(error);
      toast(`AI preview could not start: ${error.message}`, "error");
    } finally {
      refs.previewVoiceButton.disabled = false;
      refs.previewVoiceButton.innerHTML = original;
    }
  }

  function speakBrowserCurrentChunk() {
    if (!("speechSynthesis" in window)) {
      toast("Device speech is unavailable in this browser.", "error");
      pauseSpeech();
      return;
    }
    const chunk = state.chunks[state.chunkIndex];
    if (!chunk) {
      finishSpeech();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    const voice = selectedBrowserVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = Number(refs.rate.value);
    utterance.pitch = Number(refs.pitch.value);
    utterance.volume = Number(refs.volume.value);
    state.utterance = utterance;

    utterance.onstart = () => {
      if (!state.speechStartedAt) state.speechStartedAt = Date.now();
      refs.playerStatus.textContent = voice ? `${voiceDisplayName(voice)} · ${voice.lang}` : "System voice";
      highlightChunk(true);
    };
    utterance.onend = () => {
      if (!state.speaking || state.intentionalCancel || state.engine !== "browser") return;
      state.chunkIndex += 1;
      if (state.chunkIndex >= state.chunks.length) finishSpeech();
      else {
        saveCurrentDocument();
        speakCurrentChunk();
      }
    };
    utterance.onerror = event => {
      if (["interrupted", "canceled"].includes(event.error) || state.intentionalCancel) return;
      console.error("Speech synthesis error:", event.error);
      toast(`The selected device voice stopped (${event.error || "unknown error"}). Try another voice.`, "error");
      pauseSpeech();
    };
    speechSynthesis.speak(utterance);
  }

  async function speakKokoroCurrentChunk() {
    const chunk = state.chunks[state.chunkIndex];
    if (!chunk) {
      finishSpeech();
      return;
    }
    const token = state.playbackToken;
    const voice = selectedKokoroVoice();
    refs.playerStatus.textContent = state.kokoroReady ? `Preparing ${voice.name}…` : "Loading AI narrator…";
    highlightChunk(true);

    try {
      const data = await generateKokoroChunk(state.chunkIndex);
      if (token !== state.playbackToken || !state.speaking || state.paused || state.engine !== "kokoro") return;
      await playKokoroData(data, token, state.kokoroCurrentOffset);
    } catch (error) {
      if (token !== state.playbackToken) return;
      console.error(error);
      setModelStatus("error", "AI narrator unavailable", error.message || "The model could not generate speech.");
      if ("speechSynthesis" in window) {
        toast("Kokoro could not start, so Voxleaf switched to the UK device voice.", "error");
        setEngine("browser");
      } else {
        refs.playerStatus.textContent = "AI narrator unavailable";
        state.paused = true;
        refs.player.classList.add("paused");
        refs.playPauseButton.setAttribute("aria-label", "Resume");
      }
    }
  }

  function speakCurrentChunk() {
    if (!state.speaking || state.paused) return;
    if (state.sleepUntil && Date.now() >= state.sleepUntil) {
      toast("Sleep timer finished.");
      finishSpeech();
      return;
    }
    if (state.engine === "kokoro") speakKokoroCurrentChunk();
    else speakBrowserCurrentChunk();
  }

  function cancelActivePlayback() {
    state.intentionalCancel = true;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    state.intentionalCancel = false;
    stopKokoroSource(false);
    stopPreview();
  }

  function startSpeech() {
    ensureChunks();
    if (!state.chunks.length) {
      toast("Add some text first.");
      refs.text.focus();
      return;
    }
    if (refs.cursorStart.checked && state.currentMode === "edit") {
      const normalizedBeforeCursor = normalizeText(refs.text.value.slice(0, refs.text.selectionStart));
      state.chunkIndex = findChunkAtOffset(normalizedBeforeCursor.length);
    } else if (!state.currentDoc?.progressIndex && state.chunkIndex >= state.chunks.length) {
      state.chunkIndex = 0;
    }

    state.playbackToken += 1;
    cancelActivePlayback();
    state.kokoroCurrentData = null;
    state.kokoroCurrentOffset = 0;
    state.speaking = true;
    state.paused = false;
    state.speechStartedAt = 0;
    state.elapsedBeforeStart = estimatedElapsedSeconds();
    refs.player.hidden = false;
    refs.player.classList.remove("paused");
    refs.playPauseButton.setAttribute("aria-label", "Pause");
    refs.playerTitle.textContent = refs.title.value.trim() || "Untitled reading";
    showReader();
    updatePlayerUI();
    startProgressTimer();
    if (state.engine === "kokoro") ensureAudioContext().catch(() => {});
    speakCurrentChunk();
  }

  function pauseSpeech() {
    if (!state.speaking || state.paused) return;
    if (state.engine === "kokoro") stopKokoroSource(true);
    else if ("speechSynthesis" in window) speechSynthesis.pause();
    state.paused = true;
    state.elapsedBeforeStart += state.speechStartedAt ? (Date.now() - state.speechStartedAt) / 1000 : 0;
    state.speechStartedAt = 0;
    refs.player.classList.add("paused");
    refs.playPauseButton.setAttribute("aria-label", "Resume");
    refs.playerStatus.textContent = "Paused";
    updatePlayerUI();
  }

  function resumeSpeech() {
    if (!state.speaking) {
      startSpeech();
      return;
    }
    if (!state.paused) return;
    state.paused = false;
    state.speechStartedAt = Date.now();
    refs.player.classList.remove("paused");
    refs.playPauseButton.setAttribute("aria-label", "Pause");

    if (state.engine === "kokoro") {
      if (state.kokoroCurrentData) playKokoroData(state.kokoroCurrentData, state.playbackToken, state.kokoroCurrentOffset);
      else speakCurrentChunk();
    } else if (speechSynthesis.paused) speechSynthesis.resume();
    else speakCurrentChunk();
    updatePlayerUI();
  }

  function restartCurrentChunk() {
    if (!state.speaking) return;
    const wasPaused = state.paused;
    state.playbackToken += 1;
    cancelActivePlayback();
    state.kokoroCurrentData = null;
    state.kokoroCurrentOffset = 0;
    state.paused = wasPaused;
    if (!wasPaused) setTimeout(speakCurrentChunk, 40);
    updatePlayerUI();
  }

  function stopSpeech({ hidePlayer = true, preserveIndex = true } = {}) {
    state.playbackToken += 1;
    cancelActivePlayback();
    state.speaking = false;
    state.paused = false;
    state.utterance = null;
    state.kokoroCurrentData = null;
    state.kokoroCurrentOffset = 0;
    state.speechStartedAt = 0;
    clearInterval(state.progressTimer);
    state.progressTimer = null;
    if (!preserveIndex) state.chunkIndex = 0;
    if (hidePlayer) refs.player.hidden = true;
    refs.player.classList.remove("paused");
    $$(".chunk.active", refs.readerText).forEach(node => node.classList.remove("active"));
    saveCurrentDocument();
  }

  function finishSpeech() {
    state.chunkIndex = Math.max(0, state.chunks.length - 1);
    updatePlayerUI();
    stopSpeech({ hidePlayer: false, preserveIndex: true });
    refs.player.classList.add("paused");
    refs.playerStatus.textContent = "Finished";
    refs.playPauseButton.setAttribute("aria-label", "Read again");
    toast("You reached the end.");
  }

  function jumpToChunk(index, autoplay = false) {
    ensureChunks();
    state.chunkIndex = Math.max(0, Math.min(index, state.chunks.length - 1));
    state.elapsedBeforeStart = estimatedElapsedSeconds();
    state.speechStartedAt = state.speaking && !state.paused ? Date.now() : 0;
    highlightChunk(true);
    updatePlayerUI();
    saveCurrentDocument();
    if (state.speaking) {
      const shouldPlay = autoplay || !state.paused;
      state.playbackToken += 1;
      cancelActivePlayback();
      state.kokoroCurrentData = null;
      state.kokoroCurrentOffset = 0;
      if (shouldPlay) {
        state.paused = false;
        setTimeout(speakCurrentChunk, 40);
      }
    }
  }

  function jumpParagraph(direction) {
    ensureChunks();
    const currentParagraph = state.chunks[state.chunkIndex]?.paragraphIndex ?? 0;
    let index;
    if (direction > 0) index = state.chunks.findIndex(chunk => chunk.paragraphIndex > currentParagraph);
    else {
      for (let i = state.chunkIndex - 1; i >= 0; i -= 1) {
        if (state.chunks[i].paragraphIndex < currentParagraph) {
          const paragraph = state.chunks[i].paragraphIndex;
          index = state.chunks.findIndex(chunk => chunk.paragraphIndex === paragraph);
          break;
        }
      }
    }
    if (index == null || index < 0) index = direction > 0 ? state.chunks.length - 1 : 0;
    jumpToChunk(index, state.speaking && !state.paused);
  }

  function highlightChunk(scroll = false) {
    $$(".chunk.active", refs.readerText).forEach(node => node.classList.remove("active"));
    const active = $(`.chunk[data-index="${state.chunkIndex}"]`, refs.readerText);
    if (active) {
      active.classList.add("active");
      if (scroll) active.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const paragraph = (state.chunks[state.chunkIndex]?.paragraphIndex ?? 0) + 1;
    const totalParagraphs = state.chunks.length ? state.chunks[state.chunks.length - 1].paragraphIndex + 1 : 0;
    refs.readerPosition.textContent = totalParagraphs ? `Paragraph ${paragraph} of ${totalParagraphs}` : "Beginning";
  }

  function secondsForText(text) {
    return (wordCount(text) / (175 * Number(refs.rate.value))) * 60;
  }

  function estimatedElapsedSeconds() {
    return state.chunks.slice(0, state.chunkIndex).reduce((sum, chunk) => sum + secondsForText(chunk.text), 0);
  }

  function totalDurationSeconds() {
    return state.chunks.reduce((sum, chunk) => sum + secondsForText(chunk.text), 0);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const rounded = Math.floor(seconds);
    const h = Math.floor(rounded / 3600);
    const m = Math.floor((rounded % 3600) / 60);
    const s = rounded % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  function updatePlayerUI() {
    const total = Math.max(1, state.chunks.length);
    const progress = Math.max(0, Math.min(1, state.chunkIndex / total));
    refs.playerProgressBar.style.width = `${progress * 100}%`;
    refs.playerScrubber.value = String(Math.round(progress * 1000));
    const elapsed = estimatedElapsedSeconds();
    const duration = totalDurationSeconds();
    refs.elapsedLabel.textContent = formatTime(elapsed);
    refs.durationLabel.textContent = formatTime(duration);
  }

  function startProgressTimer() {
    clearInterval(state.progressTimer);
    state.progressTimer = setInterval(updatePlayerUI, 600);
  }

  function openVoiceDrawer() {
    refs.drawer.classList.add("open");
    refs.drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    renderVoiceList();
    setTimeout(() => refs.voiceSearch.focus(), 260);
  }

  function closeVoiceDrawer() {
    refs.drawer.classList.remove("open");
    refs.drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function openLibrary() {
    await renderLibrary();
    refs.libraryModal.showModal();
  }

  async function renderLibrary() {
    const docs = await getAllDocuments();
    refs.libraryList.replaceChildren();
    if (!docs.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.innerHTML = `<div><svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5H6.5A2.5 2.5 0 0 0 4 19.5Z"/></svg><strong>Your shelf is waiting</strong><p>New readings will appear here automatically.</p></div>`;
      refs.libraryList.append(empty);
      return;
    }
    docs.forEach(doc => {
      const item = document.createElement("div");
      item.className = "library-item";
      item.tabIndex = 0;
      item.dataset.id = doc.id;

      const icon = document.createElement("span");
      icon.className = "library-icon";
      icon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M8 8h8M8 12h6"/></svg>`;

      const copy = document.createElement("div");
      copy.className = "library-copy";
      const title = document.createElement("strong");
      title.textContent = doc.title || "Untitled reading";
      const preview = document.createElement("p");
      preview.textContent = normalizeText(doc.text || "") || "Empty reading";
      const meta = document.createElement("small");
      const progress = doc.text ? Math.round(((doc.progressOffset || 0) / Math.max(1, normalizeText(doc.text).length)) * 100) : 0;
      meta.textContent = `${wordCount(doc.text || "").toLocaleString()} words · ${progress}% complete · ${relativeDate(doc.updatedAt)}`;
      copy.append(title, preview, meta);

      const del = document.createElement("button");
      del.className = "library-delete";
      del.setAttribute("aria-label", `Delete ${doc.title || "reading"}`);
      del.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/></svg>`;
      del.addEventListener("click", async event => {
        event.stopPropagation();
        if (doc.id === state.currentDoc?.id) {
          toast("Create or open another reading before deleting this one.");
          return;
        }
        await deleteDocument(doc.id);
        renderLibrary();
      });

      const open = async () => {
        await loadDocument(doc);
        refs.libraryModal.close();
      };
      item.addEventListener("click", open);
      item.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
      item.append(icon, copy, del);
      refs.libraryList.append(item);
    });
  }

  function relativeDate(timestamp) {
    const delta = Date.now() - timestamp;
    const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
  }

  async function newDocument() {
    await saveCurrentDocument(true);
    await loadDocument(makeDocument(), { save: true });
    if (refs.libraryModal.open) refs.libraryModal.close();
  }

  function loadSample() {
    refs.title.value = "The book with no title";
    refs.text.value = SAMPLE_TEXT;
    state.chunkIndex = 0;
    state.lastTextHash = "";
    updateDocumentStats();
    saveCurrentDocument();
    closeDocumentMenu();
    refs.text.focus();
  }

  function downloadText() {
    const blob = new Blob([refs.text.value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(refs.title.value.trim() || "voxleaf-reading").replace(/[\\/:*?"<>|]+/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    closeDocumentMenu();
  }

  async function importFile(file) {
    if (!file) return;
    const extension = file.name.split(".").pop().toLowerCase();
    refs.importButton.disabled = true;
    const original = refs.importButton.innerHTML;
    refs.importButton.textContent = "Opening…";
    try {
      let text = "";
      let title = file.name.replace(/\.[^.]+$/, "");
      if (extension === "epub") {
        const imported = await extractEpub(file);
        text = imported.text;
        title = imported.title || title;
      } else {
        const raw = await file.text();
        if (["html", "htm"].includes(extension)) {
          const doc = new DOMParser().parseFromString(raw, "text/html");
          doc.querySelectorAll("script, style, nav, svg").forEach(node => node.remove());
          text = doc.body?.innerText || doc.body?.textContent || "";
        } else if (["md", "markdown"].includes(extension)) {
          text = markdownToReadableText(raw);
        } else text = raw;
      }
      if (!normalizeText(text)) throw new Error("No readable text was found in that file.");
      await saveCurrentDocument(true);
      await loadDocument(makeDocument({ title, text: normalizeText(text), source: extension }), { save: true });
      toast(`${file.name} is ready to read.`);
    } catch (error) {
      console.error(error);
      toast(error.message || "That file could not be opened.", "error");
    } finally {
      refs.importButton.disabled = false;
      refs.importButton.innerHTML = original;
      refs.fileInput.value = "";
    }
  }

  function markdownToReadableText(markdown) {
    return markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/[*_~]{1,3}/g, "")
      .replace(/\n{3,}/g, "\n\n");
  }

  function loadScript(src) {
    if ($(`script[src="${src}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("EPUB support could not load. Check your internet connection and try again."));
      document.head.append(script);
    });
  }

  async function extractEpub(file) {
    if (!window.JSZip) await loadScript(EPUB_SCRIPTS[0]);
    if (!window.ePub) await loadScript(EPUB_SCRIPTS[1]);
    const book = window.ePub(await file.arrayBuffer());
    await book.ready;
    const metadata = await book.loaded.metadata.catch(() => ({}));
    const sections = [];
    for (const section of book.spine.spineItems) {
      try {
        const doc = await section.load(book.load.bind(book));
        const root = doc.body || doc.documentElement;
        root.querySelectorAll("script, style, nav, svg, noscript").forEach(node => node.remove());
        const text = (root.innerText || root.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
        if (text) sections.push(text);
        section.unload();
      } catch (error) {
        console.warn("Skipped an unreadable EPUB section", error);
      }
    }
    book.destroy?.();
    return { title: metadata?.title, text: sections.join("\n\n") };
  }

  function toggleDocumentMenu() {
    const open = refs.documentMenu.hidden;
    refs.documentMenu.hidden = !open;
    refs.moreButton.setAttribute("aria-expanded", String(open));
  }

  function closeDocumentMenu() {
    refs.documentMenu.hidden = true;
    refs.moreButton.setAttribute("aria-expanded", "false");
  }

  function setSleepTimer(minutes) {
    clearInterval(state.sleepTimerInterval);
    if (!minutes) {
      state.sleepUntil = null;
      refs.sleepBadge.hidden = true;
      refs.sleepButton.dataset.tooltip = "Sleep timer";
      toast("Sleep timer turned off.");
    } else {
      state.sleepUntil = Date.now() + minutes * 60000;
      refs.sleepBadge.hidden = false;
      refs.sleepBadge.textContent = minutes;
      refs.sleepButton.dataset.tooltip = `${minutes} minute timer`;
      state.sleepTimerInterval = setInterval(updateSleepBadge, 15000);
      toast(`Voxleaf will stop in ${minutes} minutes.`);
    }
    refs.sleepPopover.hidden = true;
  }

  function updateSleepBadge() {
    if (!state.sleepUntil) return;
    const remaining = Math.max(0, Math.ceil((state.sleepUntil - Date.now()) / 60000));
    refs.sleepBadge.textContent = remaining;
    if (!remaining && state.speaking) finishSpeech();
  }

  function toggleSleepPopover() {
    if (!refs.sleepPopover.hidden) {
      refs.sleepPopover.hidden = true;
      return;
    }
    const rect = refs.sleepButton.getBoundingClientRect();
    refs.sleepPopover.style.left = `${Math.min(window.innerWidth - 185, Math.max(10, rect.left - 130))}px`;
    refs.sleepPopover.style.top = `${Math.max(10, rect.top - 215)}px`;
    refs.sleepPopover.hidden = false;
  }

  function bindEvents() {
    refs.themeButton.addEventListener("click", () => setTheme(refs.html.dataset.theme === "dark" ? "light" : "dark"));
    refs.homeButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    refs.text.addEventListener("input", () => {
      updateDocumentStats();
      state.lastTextHash = "";
      scheduleSave();
    });
    refs.title.addEventListener("input", () => {
      refs.playerTitle.textContent = refs.title.value || "Untitled reading";
      scheduleSave();
    });
    refs.readButton.addEventListener("click", startSpeech);
    refs.editButton.addEventListener("click", showEditor);
    refs.voiceButton.addEventListener("click", openVoiceDrawer);
    refs.playerVoiceButton.addEventListener("click", openVoiceDrawer);
    $$('[data-close-drawer]').forEach(node => node.addEventListener("click", closeVoiceDrawer));
    refs.voiceSearch.addEventListener("input", () => renderVoiceList());
    refs.previewVoiceButton.addEventListener("click", speakPreview);
    refs.kokoroEngineButton.addEventListener("click", () => setEngine("kokoro"));
    refs.browserEngineButton.addEventListener("click", () => setEngine("browser"));

    refs.rate.addEventListener("input", () => {
      refs.rateOutput.value = `${Number(refs.rate.value).toFixed(2).replace(/0$/, "")}×`;
      localStorage.setItem("voxleaf.rate", refs.rate.value);
      updateDocumentStats();
      updatePlayerUI();
    });
    refs.rate.addEventListener("change", () => {
      state.kokoroCache.clear();
      restartCurrentChunk();
    });
    refs.pitch.addEventListener("input", () => {
      refs.pitchOutput.value = Number(refs.pitch.value).toFixed(2).replace(/0$/, "");
      localStorage.setItem("voxleaf.pitch", refs.pitch.value);
    });
    refs.pitch.addEventListener("change", () => {
      if (state.engine === "browser") restartCurrentChunk();
    });
    refs.volume.addEventListener("input", () => {
      refs.volumeOutput.value = `${Math.round(Number(refs.volume.value) * 100)}%`;
      localStorage.setItem("voxleaf.volume", refs.volume.value);
      if (state.gainNode) state.gainNode.gain.value = Number(refs.volume.value);
    });
    refs.volume.addEventListener("change", () => {
      if (state.engine === "browser") restartCurrentChunk();
    });

    refs.importButton.addEventListener("click", () => refs.fileInput.click());
    refs.fileInput.addEventListener("change", () => importFile(refs.fileInput.files[0]));
    refs.moreButton.addEventListener("click", event => { event.stopPropagation(); toggleDocumentMenu(); });
    refs.sampleButton.addEventListener("click", loadSample);
    refs.downloadButton.addEventListener("click", downloadText);
    refs.newDocumentButton.addEventListener("click", () => { closeDocumentMenu(); newDocument(); });
    document.addEventListener("click", event => {
      if (!refs.documentMenu.contains(event.target) && event.target !== refs.moreButton) closeDocumentMenu();
      if (!refs.sleepPopover.hidden && !refs.sleepPopover.contains(event.target) && !refs.sleepButton.contains(event.target)) refs.sleepPopover.hidden = true;
    });

    refs.libraryButton.addEventListener("click", openLibrary);
    refs.closeLibraryButton.addEventListener("click", () => refs.libraryModal.close());
    refs.libraryNewButton.addEventListener("click", newDocument);

    refs.playPauseButton.addEventListener("click", () => {
      if (!state.speaking) {
        state.chunkIndex = refs.playerStatus.textContent === "Finished" ? 0 : state.chunkIndex;
        startSpeech();
      } else if (state.paused) resumeSpeech();
      else pauseSpeech();
    });
    refs.previousButton.addEventListener("click", () => jumpParagraph(-1));
    refs.nextButton.addEventListener("click", () => jumpParagraph(1));
    refs.stopButton.addEventListener("click", () => stopSpeech({ hidePlayer: true, preserveIndex: true }));
    refs.playerScrubber.addEventListener("input", () => {
      const index = Math.round((Number(refs.playerScrubber.value) / 1000) * Math.max(0, state.chunks.length - 1));
      jumpToChunk(index, false);
    });
    refs.playerScrubber.addEventListener("change", () => {
      if (state.speaking && !state.paused) restartCurrentChunk();
    });
    refs.sleepButton.addEventListener("click", event => { event.stopPropagation(); toggleSleepPopover(); });
    $$('[data-minutes]', refs.sleepPopover).forEach(button => button.addEventListener("click", () => setSleepTimer(Number(button.dataset.minutes))));

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeVoiceDrawer();
        closeDocumentMenu();
        if (refs.libraryModal.open) refs.libraryModal.close();
      }
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (!typing && event.code === "Space" && !refs.player.hidden) {
        event.preventDefault();
        state.paused ? resumeSpeech() : pauseSpeech();
      }
      if (!typing && event.altKey && event.key === "ArrowRight") jumpParagraph(1);
      if (!typing && event.altKey && event.key === "ArrowLeft") jumpParagraph(-1);
    });

    window.addEventListener("beforeunload", () => {
      if (state.currentDoc) {
        state.currentDoc.title = refs.title.value.trim() || "Untitled reading";
        state.currentDoc.text = refs.text.value;
        state.currentDoc.updatedAt = Date.now();
        state.currentDoc.progressIndex = state.chunkIndex;
        state.currentDoc.progressOffset = state.chunks[state.chunkIndex]?.start || 0;
        try {
          const tx = state.db?.transaction(DOC_STORE, "readwrite");
          tx?.objectStore(DOC_STORE).put(state.currentDoc);
        } catch (_) { /* best effort */ }
      }
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      stopKokoroSource(false);
      stopPreview();
      state.kokoroWorker?.terminate();
    });
  }

  function restoreSettings() {
    const rate = localStorage.getItem("voxleaf.rate");
    const pitch = localStorage.getItem("voxleaf.pitch");
    const volume = localStorage.getItem("voxleaf.volume");
    if (rate) refs.rate.value = rate;
    if (pitch) refs.pitch.value = pitch;
    if (volume) refs.volume.value = volume;
    if (!KOKORO_VOICES.some(voice => voice.id === state.selectedKokoroVoice)) state.selectedKokoroVoice = "bf_emma";
    if (!["kokoro", "browser"].includes(state.engine)) state.engine = "kokoro";
    refs.rate.dispatchEvent(new Event("input"));
    refs.pitch.dispatchEvent(new Event("input"));
    refs.volume.dispatchEvent(new Event("input"));
    updateVoiceUI();
    setModelStatus("", "Ready when you are", "The first AI reading downloads an approximately 90 MB open-source model once.");
  }

  async function initialize() {
    initializeTheme();
    bindEvents();
    restoreSettings();
    try {
      state.db = await openDB();
      await loadInitialDocument();
    } catch (error) {
      console.error(error);
      state.currentDoc = makeDocument();
      refs.title.value = state.currentDoc.title;
      refs.text.value = state.currentDoc.text;
      updateDocumentStats();
      toast("Local library storage is unavailable, but reading still works.", "error");
    }
    loadVoices();
    if ("speechSynthesis" in window) {
      speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
      setTimeout(loadVoices, 250);
      setTimeout(loadVoices, 1000);
    }
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).catch(error => console.warn("Service worker registration failed", error));
    }
  }

  initialize();
})();
