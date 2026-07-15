(() => {
  "use strict";

  // The MP3 files live in the repository root, one level above /book.
  // Change this to "./" if you later move the MP3 files into the /book folder.
  const AUDIO_BASE = "../";
  const STORAGE_KEY = "lights-out-audiobook-progress-v1";

  const chapters = Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      title: `Chapter ${index + 1}`,
      file: `Lights Out - ${number}.mp3`,
    };
  });

  const audio = document.getElementById("audio");
  const coverImage = document.getElementById("coverImage");
  const chapterLabel = document.getElementById("chapterLabel");
  const currentTitle = document.getElementById("currentTitle");
  const seekBar = document.getElementById("seekBar");
  const currentTime = document.getElementById("currentTime");
  const duration = document.getElementById("duration");
  const playButton = document.getElementById("playButton");
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  const previousButton = document.getElementById("previousButton");
  const nextButton = document.getElementById("nextButton");
  const backButton = document.getElementById("backButton");
  const forwardButton = document.getElementById("forwardButton");
  const speedSelect = document.getElementById("speedSelect");
  const volumeBar = document.getElementById("volumeBar");
  const chapterList = document.getElementById("chapterList");
  const progressText = document.getElementById("progressText");

  let currentChapter = 0;
  let isSeeking = false;
  let saveTimer = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const wholeSeconds = Math.floor(seconds);
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const secs = wholeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function chapterSource(index) {
    return `${AUDIO_BASE}${encodeURIComponent(chapters[index].file).replaceAll("%2F", "/")}`;
  }

  function updateRangeVisual(input, percent) {
    input.style.setProperty("--range-progress", `${clamp(percent, 0, 100)}%`);
  }

  function readSavedProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      return {
        chapter: clamp(Number(parsed.chapter) || 0, 0, chapters.length - 1),
        time: Math.max(0, Number(parsed.time) || 0),
        speed: clamp(Number(parsed.speed) || 1, 0.75, 2),
        volume: clamp(Number(parsed.volume) || 1, 0, 1),
      };
    } catch {
      return null;
    }
  }

  function saveProgress() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        chapter: currentChapter,
        time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        speed: audio.playbackRate,
        volume: audio.volume,
        updatedAt: Date.now(),
      })
    );
  }

  function queueProgressSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveProgress, 250);
  }

  function renderChapterList() {
    chapterList.replaceChildren(
      ...chapters.map((chapter, index) => {
        const item = document.createElement("li");
        item.className = "chapter-item";

        const button = document.createElement("button");
        button.className = "chapter-button";
        button.type = "button";
        button.dataset.chapterIndex = String(index);
        button.setAttribute("aria-label", `Play ${chapter.title}`);

        const number = document.createElement("span");
        number.className = "chapter-number";
        number.textContent = String(index + 1).padStart(2, "0");

        const name = document.createElement("span");
        name.className = "chapter-name";
        name.textContent = chapter.title;

        const state = document.createElement("span");
        state.className = "chapter-state";
        state.textContent = index === currentChapter ? "Playing" : "Play";

        button.append(number, name, state);
        button.addEventListener("click", () => loadChapter(index, 0, true));
        item.append(button);
        return item;
      })
    );
  }

  function syncChapterListState() {
    chapterList.querySelectorAll(".chapter-button").forEach((button, index) => {
      const active = index === currentChapter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "true" : "false");
      const state = button.querySelector(".chapter-state");
      if (state) state.textContent = active ? (audio.paused ? "Selected" : "Playing") : "Play";
    });
  }

  function syncNavigationButtons() {
    previousButton.disabled = currentChapter === 0;
    nextButton.disabled = currentChapter === chapters.length - 1;
  }

  function syncPlayButton() {
    const playing = !audio.paused && !audio.ended;
    playIcon.classList.toggle("hidden", playing);
    pauseIcon.classList.toggle("hidden", !playing);
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
    syncChapterListState();
  }

  function syncMediaSession() {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapters[currentChapter].title,
        artist: "Lights Out",
        album: "Lights Out Audiobook",
        artwork: [
          { src: new URL("./cover.jpg", window.location.href).href, sizes: "512x512", type: "image/jpeg" },
        ],
      });
    } catch {
      // Some browsers reject metadata when the artwork cannot be loaded.
    }
  }

  function updateNowPlaying() {
    currentTitle.textContent = chapters[currentChapter].title;
    chapterLabel.textContent = `Chapter ${currentChapter + 1} of ${chapters.length}`;
    document.title = `${chapters[currentChapter].title} — Lights Out`;
    syncNavigationButtons();
    syncChapterListState();
    syncMediaSession();
  }

  function loadChapter(index, startTime = 0, autoplay = false) {
    currentChapter = clamp(index, 0, chapters.length - 1);
    const desiredTime = Math.max(0, startTime);

    audio.src = chapterSource(currentChapter);
    audio.load();
    updateNowPlaying();

    const seekWhenReady = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.min(desiredTime, Math.max(0, audio.duration - 0.25));
      } else {
        audio.currentTime = desiredTime;
      }
      audio.removeEventListener("loadedmetadata", seekWhenReady);
      updateTimeline();
      queueProgressSave();

      if (autoplay) {
        audio.play().catch(() => syncPlayButton());
      }
    };

    audio.addEventListener("loadedmetadata", seekWhenReady);
  }

  function updateTimeline() {
    if (!isSeeking) {
      const ratio = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      seekBar.value = String(Math.round(ratio * 1000));
      updateRangeVisual(seekBar, ratio * 100);
    }

    currentTime.textContent = formatTime(audio.currentTime);
    duration.textContent = formatTime(audio.duration);
  }

  function togglePlayback() {
    if (!audio.src) loadChapter(currentChapter, 0, false);

    if (audio.paused || audio.ended) {
      audio.play().catch((error) => {
        console.error("Could not start audio playback:", error);
        progressText.textContent = "Playback could not start. Check that the MP3 filenames match.";
      });
    } else {
      audio.pause();
    }
  }

  function skip(seconds) {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = clamp(audio.currentTime + seconds, 0, audio.duration);
    updateTimeline();
    queueProgressSave();
  }

  function moveChapter(direction) {
    const target = currentChapter + direction;
    if (target < 0 || target >= chapters.length) return;
    loadChapter(target, 0, !audio.paused);
  }

  function setupMediaSessionActions() {
    if (!("mediaSession" in navigator)) return;

    const actions = {
      play: () => audio.play(),
      pause: () => audio.pause(),
      previoustrack: () => moveChapter(-1),
      nexttrack: () => moveChapter(1),
      seekbackward: (details) => skip(-(details.seekOffset || 15)),
      seekforward: (details) => skip(details.seekOffset || 15),
      seekto: (details) => {
        if (typeof details.seekTime === "number") {
          audio.currentTime = clamp(details.seekTime, 0, audio.duration || details.seekTime);
        }
      },
    };

    Object.entries(actions).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Browser does not support this media action.
      }
    });
  }

  coverImage.addEventListener("error", () => {
    coverImage.style.display = "none";
  });

  playButton.addEventListener("click", togglePlayback);
  previousButton.addEventListener("click", () => moveChapter(-1));
  nextButton.addEventListener("click", () => moveChapter(1));
  backButton.addEventListener("click", () => skip(-15));
  forwardButton.addEventListener("click", () => skip(15));

  seekBar.addEventListener("input", () => {
    isSeeking = true;
    const ratio = Number(seekBar.value) / 1000;
    updateRangeVisual(seekBar, ratio * 100);
    currentTime.textContent = formatTime((audio.duration || 0) * ratio);
  });

  seekBar.addEventListener("change", () => {
    const ratio = Number(seekBar.value) / 1000;
    if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * ratio;
    isSeeking = false;
    updateTimeline();
    queueProgressSave();
  });

  volumeBar.addEventListener("input", () => {
    audio.volume = Number(volumeBar.value);
    updateRangeVisual(volumeBar, audio.volume * 100);
    queueProgressSave();
  });

  speedSelect.addEventListener("change", () => {
    audio.playbackRate = Number(speedSelect.value);
    queueProgressSave();
  });

  audio.addEventListener("play", syncPlayButton);
  audio.addEventListener("pause", syncPlayButton);
  audio.addEventListener("loadedmetadata", updateTimeline);
  audio.addEventListener("durationchange", updateTimeline);
  audio.addEventListener("timeupdate", () => {
    updateTimeline();
    queueProgressSave();
  });
  audio.addEventListener("ratechange", queueProgressSave);
  audio.addEventListener("volumechange", queueProgressSave);
  audio.addEventListener("ended", () => {
    if (currentChapter < chapters.length - 1) {
      loadChapter(currentChapter + 1, 0, true);
    } else {
      syncPlayButton();
      saveProgress();
    }
  });

  audio.addEventListener("error", () => {
    progressText.textContent = `Could not load ${chapters[currentChapter].file}. Confirm it is in the repository root.`;
  });

  window.addEventListener("beforeunload", saveProgress);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveProgress();
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isFormControl = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
    if (isFormControl) return;

    if (event.code === "Space") {
      event.preventDefault();
      togglePlayback();
    } else if (event.code === "ArrowLeft") {
      event.preventDefault();
      skip(-15);
    } else if (event.code === "ArrowRight") {
      event.preventDefault();
      skip(15);
    }
  });

  const saved = readSavedProgress();
  if (saved) {
    currentChapter = saved.chapter;
    audio.playbackRate = saved.speed;
    audio.volume = saved.volume;
    speedSelect.value = String(saved.speed);
    volumeBar.value = String(saved.volume);
    updateRangeVisual(volumeBar, saved.volume * 100);
    progressText.textContent = saved.time > 2 ? "Continuing from your last saved place." : "Your place is saved automatically.";
  } else {
    updateRangeVisual(volumeBar, 100);
  }

  renderChapterList();
  setupMediaSessionActions();
  loadChapter(currentChapter, saved?.time || 0, false);
  syncPlayButton();
})();
