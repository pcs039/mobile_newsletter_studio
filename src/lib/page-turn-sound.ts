export const PAGE_TURN_SOUND_STORAGE_KEY = "datadiction_page_turn_sound";
export const LEGACY_DESKTOP_EBOOK_SOUND_STORAGE_KEY = "datadiction_desktop_ebook_sound";
export const PAGE_TURN_SOUND_CHANGE_EVENT = "datadiction:page-turn-sound-preference";

let sharedAudioContext: AudioContext | null = null;
let lastSoundAt = 0;

function getBrowserAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  sharedAudioContext ??= new AudioContextConstructor();

  return sharedAudioContext;
}

function parseStoredPreference(value: string | null) {
  if (value === null) {
    return null;
  }

  return value !== "false" && value !== "off";
}

export function readPageTurnSoundPreference() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const sharedPreference = parseStoredPreference(window.localStorage.getItem(PAGE_TURN_SOUND_STORAGE_KEY));

    if (sharedPreference !== null) {
      return sharedPreference;
    }

    const legacyDesktopPreference = parseStoredPreference(window.localStorage.getItem(LEGACY_DESKTOP_EBOOK_SOUND_STORAGE_KEY));

    return legacyDesktopPreference ?? true;
  } catch {
    return true;
  }
}

export function savePageTurnSoundPreference(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PAGE_TURN_SOUND_STORAGE_KEY, enabled ? "on" : "off");
    window.dispatchEvent(new CustomEvent(PAGE_TURN_SOUND_CHANGE_EVENT, { detail: { enabled } }));
  } catch {
    // The sound preference is decorative and must never interrupt reading.
  }
}

export function subscribeToPageTurnSoundPreference(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PAGE_TURN_SOUND_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PAGE_TURN_SOUND_CHANGE_EVENT, onStoreChange);
  };
}

export async function unlockPageTurnAudio() {
  try {
    const audioContext = getBrowserAudioContext();

    if (!audioContext) {
      return false;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    return audioContext.state === "running";
  } catch {
    return false;
  }
}

export async function playPageTurnSound() {
  if (!readPageTurnSoundPreference()) {
    return;
  }

  try {
    const nowMs = Date.now();

    if (nowMs - lastSoundAt < 90) {
      return;
    }

    const audioContext = getBrowserAudioContext();

    if (!audioContext) {
      return;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    lastSoundAt = nowMs;

    const startTime = audioContext.currentTime;
    const duration = 0.42;
    const masterGain = audioContext.createGain();
    const limiter = audioContext.createDynamicsCompressor();
    const stereoPanner = typeof audioContext.createStereoPanner === "function" ? audioContext.createStereoPanner() : null;
    const noiseBuffer = audioContext.createBuffer(1, Math.max(1, Math.floor(audioContext.sampleRate * duration)), audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);

    for (let index = 0; index < noiseData.length; index += 1) {
      const progress = index / noiseData.length;
      const quickRise = Math.min(1, progress / 0.12);
      const paperSweep = Math.max(0, 1 - progress) ** 1.35;
      const grain = 0.72 + Math.random() * 0.28;
      const microRustle = 0.72 + 0.28 * Math.sin(progress * Math.PI * 38 + Math.random() * 0.6);
      const endBrush = progress > 0.66 ? Math.max(0, 1 - (progress - 0.66) / 0.34) * 0.18 : 0;
      const envelope = (quickRise * paperSweep + endBrush) * grain * microRustle;

      noiseData[index] = (Math.random() * 2 - 1) * envelope;
    }

    limiter.threshold.setValueAtTime(-11, startTime);
    limiter.knee.setValueAtTime(16, startTime);
    limiter.ratio.setValueAtTime(5, startTime);
    limiter.attack.setValueAtTime(0.004, startTime);
    limiter.release.setValueAtTime(0.16, startTime);

    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.gain.exponentialRampToValueAtTime(0.78, startTime + 0.045);
    masterGain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.22);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    if (stereoPanner) {
      masterGain.connect(stereoPanner);
      stereoPanner.pan.setValueAtTime(-0.22, startTime);
      stereoPanner.pan.linearRampToValueAtTime(0.24, startTime + duration);
      stereoPanner.connect(limiter);
    } else {
      masterGain.connect(limiter);
    }
    limiter.connect(audioContext.destination);

    const paperSource = audioContext.createBufferSource();
    const paperLowpass = audioContext.createBiquadFilter();
    const paperHighpass = audioContext.createBiquadFilter();
    const paperGain = audioContext.createGain();

    paperSource.buffer = noiseBuffer;
    paperHighpass.type = "highpass";
    paperHighpass.frequency.setValueAtTime(260, startTime);
    paperLowpass.type = "lowpass";
    paperLowpass.frequency.setValueAtTime(5200, startTime);
    paperLowpass.frequency.exponentialRampToValueAtTime(1350, startTime + duration);
    paperLowpass.Q.setValueAtTime(0.65, startTime);
    paperGain.gain.setValueAtTime(0.42, startTime);
    paperGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    paperSource.connect(paperHighpass);
    paperHighpass.connect(paperLowpass);
    paperLowpass.connect(paperGain);
    paperGain.connect(masterGain);

    const rustleSource = audioContext.createBufferSource();
    const rustleBandpass = audioContext.createBiquadFilter();
    const rustleGain = audioContext.createGain();

    rustleSource.buffer = noiseBuffer;
    rustleBandpass.type = "bandpass";
    rustleBandpass.frequency.setValueAtTime(3600, startTime);
    rustleBandpass.frequency.exponentialRampToValueAtTime(1100, startTime + 0.34);
    rustleBandpass.Q.setValueAtTime(1.15, startTime);
    rustleGain.gain.setValueAtTime(0.17, startTime);
    rustleGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.34);
    rustleSource.connect(rustleBandpass);
    rustleBandpass.connect(rustleGain);
    rustleGain.connect(masterGain);

    paperSource.start(startTime);
    paperSource.stop(startTime + duration);
    rustleSource.start(startTime + 0.055);
    rustleSource.stop(startTime + 0.36);
  } catch {
    // Page turn sound is decorative and should never interrupt navigation.
  }
}

export async function enablePageTurnSoundWithPreview() {
  savePageTurnSoundPreference(true);
  await unlockPageTurnAudio();
  await playPageTurnSound();
}
