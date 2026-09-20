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
    const masterGain = audioContext.createGain();
    const tickOscillator = audioContext.createOscillator();
    const tickGain = audioContext.createGain();
    const noiseBuffer = audioContext.createBuffer(1, Math.max(1, Math.floor(audioContext.sampleRate * 0.14)), audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    const noiseSource = audioContext.createBufferSource();
    const noiseFilter = audioContext.createBiquadFilter();
    const noiseGain = audioContext.createGain();

    for (let index = 0; index < noiseData.length; index += 1) {
      const fadeOut = 1 - index / noiseData.length;
      noiseData[index] = (Math.random() * 2 - 1) * fadeOut * fadeOut;
    }

    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.gain.exponentialRampToValueAtTime(0.085, startTime + 0.014);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.15);
    masterGain.connect(audioContext.destination);

    tickOscillator.type = "triangle";
    tickOscillator.frequency.setValueAtTime(760, startTime);
    tickOscillator.frequency.exponentialRampToValueAtTime(320, startTime + 0.07);
    tickGain.gain.setValueAtTime(0.036, startTime);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.09);
    tickOscillator.connect(tickGain);
    tickGain.connect(masterGain);

    noiseSource.buffer = noiseBuffer;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1500, startTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(760, startTime + 0.12);
    noiseFilter.Q.setValueAtTime(0.9, startTime);
    noiseGain.gain.setValueAtTime(0.045, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    tickOscillator.start(startTime);
    tickOscillator.stop(startTime + 0.095);
    noiseSource.start(startTime);
    noiseSource.stop(startTime + 0.15);
  } catch {
    // Page turn sound is decorative and should never interrupt navigation.
  }
}

export async function enablePageTurnSoundWithPreview() {
  savePageTurnSoundPreference(true);
  await unlockPageTurnAudio();
  await playPageTurnSound();
}
