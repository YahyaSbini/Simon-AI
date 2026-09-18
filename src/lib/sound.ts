const STORAGE_KEY = "simon:sound-muted";

let context: AudioContext | null = null;

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setSoundMuted(muted: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
}

/** Short two-note chime synthesised on the fly; no audio assets needed. */
export function playCompleteSound(): void {
  if (typeof window === "undefined" || isSoundMuted()) return;

  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();

    const now = context.currentTime;
    const master = context.createGain();
    master.gain.value = 0.12;
    master.connect(context.destination);

    const notes: [number, number][] = [
      [880, 0],
      [1320, 0.09],
    ];

    for (const [frequency, offset] of notes) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(1, now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.25);
    }
  } catch {
    // Audio is a nicety; never let it break a tick.
  }
}
