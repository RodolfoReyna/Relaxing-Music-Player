(function () {
  "use strict";

  const playPauseBtn = document.getElementById("playPause");
  const btnLabel = playPauseBtn.querySelector(".btn-label");
  const soundSourceSelect = document.getElementById("soundSource");
  const sourceStatus = document.getElementById("sourceStatus");
  const toneControl = document.getElementById("toneControl");
  const frequencyInput = document.getElementById("frequency");
  const frequencyValue = document.getElementById("frequencyValue");
  const volumeInput = document.getElementById("volume");
  const volumeValue = document.getElementById("volumeValue");
  const panInput = document.getElementById("pan");
  const panValue = document.getElementById("panValue");
  const timerMinutesInput = document.getElementById("timerMinutes");
  const timerDisplay = document.getElementById("timerDisplay");

  /** @type {Array<{id: string, label: string, file: string | null, audio_url: string | null}>} */
  let trackOptions = [];
  /** @type {object | null} */
  let sessionConfig = null;

  /** @type {AudioContext | null} */
  let audioContext = null;
  /** @type {AudioBufferSourceNode | null} */
  let activeSourceNode = null;
  /** @type {BiquadFilterNode | null} */
  let filterNode = null;
  /** @type {GainNode | null} */
  let gainNode = null;
  /** @type {StereoPannerNode | null} */
  let pannerNode = null;
  /** @type {Map<string, AudioBuffer>} */
  const decodedTracks = new Map();

  let isPlaying = false;
  let timerEndTime = 0;
  let pausedTimerRemainingMs = 0;
  let timerRafId = 0;

  const NOISE_DURATION = 2;

  function formatFrequency(hz) {
    if (hz >= 1000) {
      return (hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1) + " kHz";
    }
    return Math.round(hz) + " Hz";
  }

  function updateFrequencyLabel() {
    frequencyValue.textContent = formatFrequency(Number(frequencyInput.value));
  }

  function updateVolumeLabel() {
    volumeValue.textContent = volumeInput.value + "%";
  }

  function updatePanLabel() {
    const pan = Number(panInput.value);
    if (pan === 0) {
      panValue.textContent = "Center";
    } else if (pan < 0) {
      panValue.textContent = "L " + Math.abs(pan);
    } else {
      panValue.textContent = "R " + pan;
    }
  }

  function ensureContext() {
    if (!audioContext) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioContext = new AC();
    }
    return audioContext;
  }

  function getSelectedTrack() {
    return trackOptions.find((track) => track.id === soundSourceSelect.value) || trackOptions[0];
  }

  function isGeneratedNoise() {
    return Boolean(sessionConfig?.tone_control_enabled);
  }

  function updateSourceStatus(text) {
    sourceStatus.textContent = text;
  }

  function toggleToneControl() {
    const enabled = Boolean(sessionConfig?.tone_control_enabled);
    frequencyInput.disabled = !enabled;
    frequencyInput.setAttribute("aria-disabled", String(!enabled));
    toneControl.classList.toggle("tone-control--disabled", !enabled);
    toneControl.setAttribute("aria-disabled", String(!enabled));
    updateSourceStatus("Ready");
  }

  function getPlayingStatus() {
    return "Playing " + (sessionConfig?.track_label || "audio");
  }

  function buildSourceDropdown() {
    soundSourceSelect.innerHTML = "";
    for (const option of trackOptions) {
      const el = document.createElement("option");
      el.value = option.id;
      el.textContent = option.label;
      soundSourceSelect.appendChild(el);
    }
  }

  async function fetchSessionConfig() {
    const response = await fetch("/api/session/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sound_source: soundSourceSelect.value,
        frequency_hz: Number(frequencyInput.value),
        volume_percent: Number(volumeInput.value),
        pan_percent: Number(panInput.value),
        timer_minutes: Number(timerMinutesInput.value) || 0
      })
    });

    if (!response.ok) {
      throw new Error("Server rejected session settings");
    }

    sessionConfig = await response.json();
    return sessionConfig;
  }

  async function loadTracksFromServer() {
    const response = await fetch("/api/tracks");
    if (!response.ok) {
      throw new Error("Could not load track catalog");
    }
    const payload = await response.json();
    trackOptions = payload.tracks;
    buildSourceDropdown();
    soundSourceSelect.value = trackOptions[0]?.id || "noise";
  }

  async function loadTrackBuffer(track) {
    if (!track.file || !track.audio_url) {
      return null;
    }
    if (decodedTracks.has(track.file)) {
      return decodedTracks.get(track.file);
    }
    updateSourceStatus("Loading...");
    const response = await fetch(track.audio_url);
    if (!response.ok) {
      updateSourceStatus("Missing file");
      throw new Error(`Missing audio file: ${track.file}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const decoded = await ensureContext().decodeAudioData(arrayBuffer.slice(0));
    decodedTracks.set(track.file, decoded);
    updateSourceStatus("Ready");
    return decoded;
  }

  function createWhiteNoiseBuffer(ctx) {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * NOISE_DURATION);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function createBrownNoiseBuffer(ctx) {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * NOISE_DURATION);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = Math.max(-1, Math.min(1, last * 3.5));
    }
    return buffer;
  }

  function createGeneratedNoiseBuffer(ctx, soundSource) {
    return soundSource === "brown-noise"
      ? createBrownNoiseBuffer(ctx)
      : createWhiteNoiseBuffer(ctx);
  }

  function clearSourceNode() {
    if (!activeSourceNode) {
      return;
    }
    try {
      activeSourceNode.stop();
    } catch (_) {}
    activeSourceNode.disconnect();
    activeSourceNode = null;
  }

  function connectGraphWithNode(sourceNode) {
    clearSourceNode();
    activeSourceNode = sourceNode;
    const ctx = ensureContext();

    filterNode = ctx.createBiquadFilter();
    filterNode.type = sessionConfig.filter_type;
    filterNode.frequency.value = sessionConfig.filter_frequency_hz;
    filterNode.Q.value = 0.7;

    gainNode = ctx.createGain();
    gainNode.gain.value = sessionConfig.effective_gain;

    pannerNode = ctx.createStereoPanner();
    pannerNode.pan.value = sessionConfig.pan_value;

    activeSourceNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(ctx.destination);
  }

  function createGeneratedSourceNode() {
    const ctx = ensureContext();
    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = createGeneratedNoiseBuffer(ctx, sessionConfig.sound_source);
    sourceNode.loop = true;
    return sourceNode;
  }

  async function createTrackSourceNode(track) {
    const buffer = await loadTrackBuffer(track);
    const sourceNode = ensureContext().createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = true;
    return sourceNode;
  }

  function applyPlaybackSettings() {
    if (!sessionConfig || !filterNode || !gainNode || !pannerNode) {
      return;
    }
    const now = ensureContext().currentTime;
    filterNode.type = sessionConfig.filter_type;
    if (isGeneratedNoise()) {
      filterNode.frequency.setValueAtTime(sessionConfig.filter_frequency_hz, now);
    }
    gainNode.gain.setValueAtTime(sessionConfig.effective_gain, now);
    pannerNode.pan.setValueAtTime(sessionConfig.pan_value, now);
  }

  function clearTimerLoop() {
    if (timerRafId) {
      cancelAnimationFrame(timerRafId);
      timerRafId = 0;
    }
  }

  function updateTimerDisplay(remainingMs) {
    if (remainingMs <= 0) {
      timerDisplay.textContent = "Off";
      return;
    }
    const totalSec = Math.ceil(remainingMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    timerDisplay.textContent = m > 0 ? m + ":" + String(s).padStart(2, "0") : s + "s";
  }

  function timerLoop() {
    if (!isPlaying || timerEndTime <= 0) {
      clearTimerLoop();
      return;
    }
    const now = performance.now();
    const left = timerEndTime - now;
    if (left <= 0) {
      stopPlayback();
      timerDisplay.textContent = "Done";
      clearTimerLoop();
      return;
    }
    updateTimerDisplay(left);
    timerRafId = requestAnimationFrame(timerLoop);
  }

  function startTimerIfNeeded() {
    clearTimerLoop();
    const durationMs = sessionConfig?.timer_duration_ms || 0;
    const now = performance.now();

    if (pausedTimerRemainingMs > 0) {
      timerEndTime = now + pausedTimerRemainingMs;
      pausedTimerRemainingMs = 0;
    } else if (durationMs > 0) {
      timerEndTime = now + durationMs;
    } else {
      timerEndTime = 0;
      timerDisplay.textContent = "Off";
      return;
    }

    updateTimerDisplay(timerEndTime - now);
    timerRafId = requestAnimationFrame(timerLoop);
  }

  function stopPlayback() {
    if (timerEndTime > 0) {
      const left = timerEndTime - performance.now();
      pausedTimerRemainingMs = left > 0 ? left : 0;
    }
    isPlaying = false;
    playPauseBtn.setAttribute("aria-pressed", "false");
    playPauseBtn.setAttribute("aria-label", "Play");
    btnLabel.textContent = "Play";

    clearSourceNode();
    filterNode = null;
    gainNode = null;
    pannerNode = null;
    clearTimerLoop();
    timerEndTime = 0;

    updateSourceStatus("Ready");
  }

  async function startPlayback() {
    await fetchSessionConfig();

    const ctx = ensureContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const selectedTrack = getSelectedTrack();
    const sourceNode = isGeneratedNoise()
      ? createGeneratedSourceNode()
      : await createTrackSourceNode(selectedTrack);

    connectGraphWithNode(sourceNode);
    sourceNode.start(0);
    applyPlaybackSettings();
    isPlaying = true;
    playPauseBtn.setAttribute("aria-pressed", "true");
    playPauseBtn.setAttribute("aria-label", "Pause");
    btnLabel.textContent = "Pause";
    updateSourceStatus(getPlayingStatus());
    startTimerIfNeeded();
  }

  playPauseBtn.addEventListener("click", async () => {
    if (isPlaying) {
      stopPlayback();
      if (pausedTimerRemainingMs > 0) {
        updateTimerDisplay(pausedTimerRemainingMs);
      } else if ((sessionConfig?.timer_duration_ms || 0) <= 0) {
        timerDisplay.textContent = "Off";
      }
      return;
    }

    try {
      await startPlayback();
    } catch (_) {
      updateSourceStatus("Load failed");
    }
  });

  frequencyInput.addEventListener("input", async () => {
    updateFrequencyLabel();
    if (!isPlaying) {
      return;
    }
    try {
      await fetchSessionConfig();
      applyPlaybackSettings();
    } catch (_) {}
  });

  volumeInput.addEventListener("input", async () => {
    updateVolumeLabel();
    if (!isPlaying) {
      return;
    }
    try {
      await fetchSessionConfig();
      applyPlaybackSettings();
    } catch (_) {}
  });

  panInput.addEventListener("input", async () => {
    updatePanLabel();
    if (!isPlaying) {
      return;
    }
    try {
      await fetchSessionConfig();
      applyPlaybackSettings();
    } catch (_) {}
  });

  timerMinutesInput.addEventListener("change", async () => {
    try {
      await fetchSessionConfig();
    } catch (_) {
      return;
    }

    const durationMs = sessionConfig.timer_duration_ms;
    timerMinutesInput.value = String(sessionConfig.timer_minutes);
    pausedTimerRemainingMs = durationMs > 0 ? durationMs : 0;

    if (isPlaying && durationMs > 0) {
      pausedTimerRemainingMs = 0;
      startTimerIfNeeded();
    } else if (!isPlaying && durationMs > 0) {
      updateTimerDisplay(durationMs);
    } else if (durationMs <= 0) {
      pausedTimerRemainingMs = 0;
      if (!isPlaying) {
        timerDisplay.textContent = "Off";
      }
    }
  });

  soundSourceSelect.addEventListener("change", async () => {
    try {
      await fetchSessionConfig();
    } catch (_) {
      updateSourceStatus("Server error");
      return;
    }

    toggleToneControl();
    const selectedTrack = getSelectedTrack();

    if (selectedTrack?.file) {
      try {
        await loadTrackBuffer(selectedTrack);
      } catch (_) {}
    }

    if (isPlaying) {
      try {
        stopPlayback();
        await startPlayback();
      } catch (_) {
        updateSourceStatus("Load failed");
      }
    }
  });

  async function init() {
    try {
      await loadTracksFromServer();
      await fetchSessionConfig();
      panInput.value = String(sessionConfig.pan_percent);
      toggleToneControl();
      updateFrequencyLabel();
      updateVolumeLabel();
      updatePanLabel();
    } catch (_) {
      updateSourceStatus("Server offline");
    }
  }

  init();
})();
