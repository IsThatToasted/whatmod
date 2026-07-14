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
    selectedStartOffset: 0
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

  function selectedVoice() {
    return state.voices.find(v => v.voiceURI === state.selectedVoiceURI) || state.voices[0] || null;
  }

  function voiceDisplayName(voice) {
    if (!voice) return "Default system voice";
    return voice.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  }

  function bestDefaultVoice(voices) {
    const language = navigator.language || "en-US";
    const localSameLang = voices.filter(v => v.localService && v.lang?.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
    const sameLang = voices.filter(v => v.lang?.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
    const preferredPattern = /aria|jenny|samantha|serena|daniel|google us english|natural|enhanced/i;
    return localSameLang.find(v => preferredPattern.test(v.name)) || sameLang.find(v => preferredPattern.test(v.name)) || localSameLang[0] || sameLang[0] || voices.find(v => v.localService) || voices[0];
  }

  function loadVoices() {
    if (!("speechSynthesis" in window)) {
      refs.voiceLabel.textContent = "Speech not supported";
      refs.readButton.disabled = true;
      toast("This browser does not support text-to-speech. Try current Chrome, Edge, Safari, or Firefox.", "error");
      return;
    }
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;
    state.voices = [...voices].sort((a, b) => {
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
      return a.name.localeCompare(b.name);
    });
    if (!state.voices.some(v => v.voiceURI === state.selectedVoiceURI)) {
      state.selectedVoiceURI = bestDefaultVoice(state.voices)?.voiceURI || "";
    }
    updateVoiceUI();
    renderVoiceList();
  }

  function updateVoiceUI() {
    const voice = selectedVoice();
    refs.voiceLabel.textContent = voiceDisplayName(voice);
    refs.voiceAvatar.textContent = voiceDisplayName(voice).charAt(0).toUpperCase() || "V";
    localStorage.setItem("voxleaf.voiceURI", state.selectedVoiceURI);
  }

  function renderVoiceList(filter = refs.voiceSearch.value.trim().toLowerCase()) {
    refs.voiceList.replaceChildren();
    const voices = state.voices.filter(voice => !filter || `${voice.name} ${voice.lang}`.toLowerCase().includes(filter));
    if (!voices.length) {
      const empty = document.createElement("p");
      empty.className = "setting-note";
      empty.textContent = state.voices.length ? "No voices match that search." : "Your browser is still loading its voice list…";
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

  function speakPreview() {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("This is how your reading will sound in Voxleaf.");
    const voice = selectedVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = Number(refs.rate.value);
    utterance.pitch = Number(refs.pitch.value);
    utterance.volume = Number(refs.volume.value);
    speechSynthesis.speak(utterance);
  }

  function speakCurrentChunk() {
    if (!state.speaking || state.paused) return;
    const chunk = state.chunks[state.chunkIndex];
    if (!chunk) {
      finishSpeech();
      return;
    }
    if (state.sleepUntil && Date.now() >= state.sleepUntil) {
      toast("Sleep timer finished.");
      finishSpeech();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    const voice = selectedVoice();
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
      if (!state.speaking || state.intentionalCancel) return;
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
      toast(`The selected voice stopped (${event.error || "unknown error"}). Try another voice.`, "error");
      pauseSpeech();
    };
    speechSynthesis.speak(utterance);
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
    state.intentionalCancel = true;
    speechSynthesis.cancel();
    state.intentionalCancel = false;
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
    speakCurrentChunk();
  }

  function pauseSpeech() {
    if (!state.speaking || state.paused) return;
    speechSynthesis.pause();
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
    if (speechSynthesis.paused) speechSynthesis.resume();
    else speakCurrentChunk();
    updatePlayerUI();
  }

  function restartCurrentChunk() {
    if (!state.speaking) return;
    const wasPaused = state.paused;
    state.intentionalCancel = true;
    speechSynthesis.cancel();
    state.intentionalCancel = false;
    state.paused = wasPaused;
    if (!wasPaused) setTimeout(speakCurrentChunk, 40);
    updatePlayerUI();
  }

  function stopSpeech({ hidePlayer = true, preserveIndex = true } = {}) {
    state.intentionalCancel = true;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    state.intentionalCancel = false;
    state.speaking = false;
    state.paused = false;
    state.utterance = null;
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
      state.intentionalCancel = true;
      speechSynthesis.cancel();
      state.intentionalCancel = false;
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
      for (let i = state.chunkIndex - 1; i >= 0; i--) {
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

    refs.rate.addEventListener("input", () => {
      refs.rateOutput.value = `${Number(refs.rate.value).toFixed(2).replace(/0$/, "")}×`;
      localStorage.setItem("voxleaf.rate", refs.rate.value);
      updateDocumentStats();
      updatePlayerUI();
    });
    refs.rate.addEventListener("change", restartCurrentChunk);
    refs.pitch.addEventListener("input", () => {
      refs.pitchOutput.value = Number(refs.pitch.value).toFixed(2).replace(/0$/, "");
      localStorage.setItem("voxleaf.pitch", refs.pitch.value);
    });
    refs.pitch.addEventListener("change", restartCurrentChunk);
    refs.volume.addEventListener("input", () => {
      refs.volumeOutput.value = `${Math.round(Number(refs.volume.value) * 100)}%`;
      localStorage.setItem("voxleaf.volume", refs.volume.value);
    });
    refs.volume.addEventListener("change", restartCurrentChunk);

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
    });
  }

  function restoreSettings() {
    const rate = localStorage.getItem("voxleaf.rate");
    const pitch = localStorage.getItem("voxleaf.pitch");
    const volume = localStorage.getItem("voxleaf.volume");
    if (rate) refs.rate.value = rate;
    if (pitch) refs.pitch.value = pitch;
    if (volume) refs.volume.value = volume;
    refs.rate.dispatchEvent(new Event("input"));
    refs.pitch.dispatchEvent(new Event("input"));
    refs.volume.dispatchEvent(new Event("input"));
  }

  async function initialize() {
    initializeTheme();
    restoreSettings();
    bindEvents();
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
      navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker registration failed", error));
    }
  }

  initialize();
})();
